import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {validFullOutput} from '@core/fixtures/index';
import {
  executeAccountReplacementTransaction,
  getDatabase,
  resetDatabaseForTests,
  wipeDatabase,
} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {INSTALL_MARKER_KEY} from '@core/db/installMarker';
import {enqueueSyncOutboxEvent} from '@core/db/syncOutboxCore';
import {saveFlashcard} from '@features/review';
import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@/test-support/adversarial/realSqlite';

/**
 * LING-108 adversarial r1 — attack INV-001/002/003 against the production
 * account-replacement primitive on a real `node:sqlite` engine. These tests
 * exercise failure points the developer's suite does not: a delete-loop abort
 * before the pointer write, an abort on the outbox delete itself, and
 * recovery of the connection after a failed attempt.
 */

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const INSTALL_AT = '2026-09-28T08:00:00.000Z';

let dbFile: string;
let db: RealSqliteConnection;

function openFileDb(): RealSqliteConnection {
  const connection = openRealSqlite(dbFile);
  resetDatabaseForTests(connection);
  runMigrations(connection);
  getDatabase();
  return connection;
}

function count(sql: string, params: unknown[] = []): number {
  const row = db.execute(sql, params as never[]).rows?.item(0) as
    | {c: number}
    | undefined;
  return Number(row?.c ?? 0);
}

function tableCounts(): Record<string, number> {
  const tables = db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  ).rows!._array as Array<{name: string}>;
  const counts: Record<string, number> = {};
  for (const {name} of tables) {
    counts[name] = count(`SELECT COUNT(*) AS c FROM ${name}`);
  }
  return counts;
}

function totalUserTableRows(): number {
  return Object.values(tableCounts()).reduce((a, b) => a + b, 0);
}

function readSetting(key: string): string | null {
  const row = db
    .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [key])
    .rows?.item(0) as {value?: string} | undefined;
  return row?.value ?? null;
}

function foreignKeysPragma(): number {
  const row = db.execute('PRAGMA foreign_keys;').rows?.item(0) as
    | {foreign_keys?: number}
    | undefined;
  return Number(row?.foreign_keys ?? -1);
}

function snapshot() {
  return {
    pointer: readSetting('current_account_id'),
    marker: readSetting(INSTALL_MARKER_KEY),
    counts: tableCounts(),
  };
}

function seedAccountAData(): void {
  db.execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    ['current_account_id', USER_A, '2026-09-27T00:00:00.000Z'],
  );
  db.execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    [INSTALL_MARKER_KEY, '2026-09-27T00:00:00.000Z', '2026-09-27T00:00:00.000Z'],
  );
  db.execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    ['account.fallback_device_id', 'device-1', '2026-09-27T00:00:00.000Z'],
  );
  const saved = saveFlashcard({
    lessonId: 'lesson-a',
    vocabulary: validFullOutput.vocabulary[0],
    now: '2026-09-27T01:00:00.000Z',
  });
  if (!saved.ok) {
    throw new Error('saveFlashcard failed');
  }
  enqueueSyncOutboxEvent({
    id: 'outbox-pending-1',
    entityId: saved.flashcardId,
    payload: {kind: 'test'},
    createdAt: '2026-09-27T02:00:00.000Z',
  });
  db.execute(
    `INSERT INTO sync_outbox (
       id, event_type, entity_id, payload_json, created_at, attempt_count,
       last_error, synced_at
     ) VALUES (?, ?, ?, ?, ?, 0, NULL, ?);`,
    [
      'outbox-synced-1',
      'review',
      saved.flashcardId,
      JSON.stringify({kind: 'test'}),
      '2026-09-27T03:00:00.000Z',
      '2026-09-27T04:00:00.000Z',
    ],
  );
  db.execute(
    `INSERT INTO youtube_progress (lesson_id, position_ms, segment_index, updated_at)
     VALUES (?, ?, ?, ?);`,
    ['yt-1', 1000, 0, '2026-09-27T02:00:00.000Z'],
  );
  db.execute(
    `INSERT INTO gamification_events (id, event_type, points, created_at)
     VALUES (?, ?, ?, ?);`,
    ['game-1', 'review', 5, '2026-09-27T02:00:00.000Z'],
  );
}

beforeEach(() => {
  dbFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'ling108-advr1-')),
    'lingobites.sqlite',
  );
  db = openFileDb();
});

afterEach(() => {
  try {
    db.close();
  } catch {
    // already closed
  }
  resetDatabaseForTests(null);
  fs.rmSync(path.dirname(dbFile), {recursive: true, force: true});
});

describe('LING-108 adversarial r1 atomic replacement (real SQLite)', () => {
  it('ADV-001 / INV-001: a delete-loop abort during replacement rolls back every A row', () => {
    seedAccountAData();
    const before = snapshot();
    expect(before.counts.flashcards).toBeGreaterThan(0);

    db.raw.exec(`CREATE TRIGGER adv_r1_fail_flashcard_delete
      BEFORE DELETE ON flashcards
      BEGIN
        SELECT RAISE(ABORT, 'ADV-001 injected delete abort');
      END;`);

    expect(() =>
      executeAccountReplacementTransaction(db, USER_B, {
        installCompletedAt: INSTALL_AT,
      }),
    ).toThrow(/ADV-001 injected delete abort/);

    expect(snapshot()).toEqual(before);
    expect(readSetting('current_account_id')).toBe(USER_A);
  });

  it('ADV-002 / INV-002: an abort on the outbox delete leaves the pending outbox row and pointer intact', () => {
    seedAccountAData();
    expect(count('SELECT COUNT(*) AS c FROM sync_outbox')).toBe(2);

    db.raw.exec(`CREATE TRIGGER adv_r1_fail_outbox_delete
      BEFORE DELETE ON sync_outbox
      BEGIN
        SELECT RAISE(ABORT, 'ADV-002 injected outbox abort');
      END;`);

    expect(() =>
      executeAccountReplacementTransaction(db, USER_B, {
        installCompletedAt: INSTALL_AT,
      }),
    ).toThrow(/ADV-002 injected outbox abort/);

    expect(readSetting('current_account_id')).toBe(USER_A);
    expect(count('SELECT COUNT(*) AS c FROM sync_outbox')).toBe(2);
    expect(
      count("SELECT COUNT(*) AS c FROM sync_outbox WHERE id = 'outbox-pending-1'"),
    ).toBe(1);
  });

  it('ADV-003 / INV-002: success removes pending AND synced outbox rows with the account', () => {
    seedAccountAData();

    executeAccountReplacementTransaction(db, USER_B, {
      installCompletedAt: INSTALL_AT,
    });

    expect(readSetting('current_account_id')).toBe(USER_B);
    expect(count('SELECT COUNT(*) AS c FROM sync_outbox')).toBe(0);
    expect(
      count(
        "SELECT COUNT(*) AS c FROM sync_outbox WHERE entity_id LIKE '%'",
      ),
    ).toBe(0);
    const counts = tableCounts();
    const nonEmpty = Object.entries(counts).filter(
      ([name, c]) => c > 0 && name !== 'app_settings',
    );
    expect(nonEmpty).toEqual([]);
    expect(totalUserTableRows()).toBe(2);
  });

  it('ADV-004 / INV-003: the connection stays usable and a retry succeeds after a failed replacement', () => {
    seedAccountAData();
    db.raw.exec(`CREATE TRIGGER adv_r1_fail_then_retry
      BEFORE DELETE ON flashcards
      BEGIN
        SELECT RAISE(ABORT, 'ADV-004 first attempt abort');
      END;`);
    expect(() =>
      executeAccountReplacementTransaction(db, USER_B, {
        installCompletedAt: INSTALL_AT,
      }),
    ).toThrow(/ADV-004 first attempt abort/);
    expect(readSetting('current_account_id')).toBe(USER_A);

    db.raw.exec('DROP TRIGGER adv_r1_fail_then_retry;');
    expect(() =>
      executeAccountReplacementTransaction(db, USER_B, {
        installCompletedAt: INSTALL_AT,
      }),
    ).not.toThrow();

    expect(readSetting('current_account_id')).toBe(USER_B);
    expect(readSetting(INSTALL_MARKER_KEY)).toBe(INSTALL_AT);
    expect(count('SELECT COUNT(*) AS c FROM flashcards')).toBe(0);
    expect(count('SELECT COUNT(*) AS c FROM sync_outbox')).toBe(0);
  });

  it('ADV-005 / RISK-006 + INV-003: wipeDatabase keeps every row and restores FK state on abort', () => {
    seedAccountAData();
    const before = snapshot();
    const fkBefore = foreignKeysPragma();

    db.raw.exec(`CREATE TRIGGER adv_r1_fail_wipe_delete
      BEFORE DELETE ON flashcards
      BEGIN
        SELECT RAISE(ABORT, 'ADV-005 injected wipe abort');
      END;`);

    expect(() => wipeDatabase(db)).toThrow(/ADV-005 injected wipe abort/);

    expect(snapshot()).toEqual(before);
    expect(foreignKeysPragma()).toBe(fkBefore);
    expect(db.execute('SELECT 1 AS one;').rows?.item(0)).toEqual({one: 1});
  });
});
