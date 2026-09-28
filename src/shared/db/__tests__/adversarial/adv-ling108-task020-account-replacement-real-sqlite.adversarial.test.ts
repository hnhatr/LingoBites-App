import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {validFullOutput} from '@shared/fixtures';
import {
  executeAccountReplacementTransaction,
  getDatabase,
  resetDatabaseForTests,
  wipeDatabase,
} from '@shared/db/database';
import {runMigrations} from '@shared/db/migrations';
import {INSTALL_MARKER_KEY} from '@shared/db/installMarker';
import {enqueueSyncOutboxEvent} from '@shared/db/syncOutboxCore';
import {saveFlashcard} from '@features/review';
import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@/test-support/adversarial/realSqlite';

/**
 * LING-108 TASK-020: production `executeAccountReplacementTransaction` and
 * `wipeDatabase` rollback on real SQLite (`node:sqlite`).
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

function totalUserTableRows(): number {
  const tables = db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  ).rows!._array as Array<{name: string}>;
  let total = 0;
  for (const {name} of tables) {
    total += count(`SELECT COUNT(*) AS c FROM ${name}`);
  }
  return total;
}

function readSetting(key: string): string | null {
  const row = db
    .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [key])
    .rows?.item(0) as {value?: string} | undefined;
  return row?.value ?? null;
}

function snapshotState(): {totalRows: number; accountId: string | null} {
  return {
    totalRows: totalUserTableRows(),
    accountId: readSetting('current_account_id'),
  };
}

function seedAccountAData(): void {
  db.execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    ['current_account_id', USER_A, '2026-09-27T00:00:00.000Z'],
  );
  db.execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    [
      INSTALL_MARKER_KEY,
      '2026-09-27T00:00:00.000Z',
      '2026-09-27T00:00:00.000Z',
    ],
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
    id: 'outbox-1',
    entityId: saved.flashcardId,
    payload: {kind: 'test'},
    createdAt: '2026-09-27T02:00:00.000Z',
  });
  db.execute(
    `INSERT INTO youtube_progress (lesson_id, position_ms, segment_index, updated_at)
     VALUES (?, ?, ?, ?);`,
    ['yt-1', 1000, 0, '2026-09-27T02:00:00.000Z'],
  );
}

beforeEach(() => {
  dbFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'ling108-adv-')),
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

describe('LING-108 TASK-020 account replacement (real SQLite)', () => {
  it('INV-001 / AC-014: success clears all app rows and commits the new account pointer', () => {
    seedAccountAData();
    const beforeRows = totalUserTableRows();
    expect(beforeRows).toBeGreaterThan(2);

    executeAccountReplacementTransaction(db, USER_B, {
      installCompletedAt: INSTALL_AT,
    });

    expect(readSetting('current_account_id')).toBe(USER_B);
    expect(readSetting(INSTALL_MARKER_KEY)).toBe(INSTALL_AT);
    expect(count('SELECT COUNT(*) AS c FROM flashcards')).toBe(0);
    expect(count('SELECT COUNT(*) AS c FROM sync_outbox')).toBe(0);
    expect(count('SELECT COUNT(*) AS c FROM youtube_progress')).toBe(0);
    expect(readSetting('account.fallback_device_id')).toBeNull();
    expect(totalUserTableRows()).toBe(2);
  });

  it('INV-002 / AC-015: mid-transaction failure leaves outbox and account pointer unchanged', () => {
    seedAccountAData();
    const before = snapshotState();
    expect(count('SELECT COUNT(*) AS c FROM sync_outbox')).toBe(1);

    db.raw.exec(`CREATE TRIGGER adv_ling108_fail_account_pointer
      BEFORE INSERT ON app_settings
      WHEN NEW.key = 'current_account_id'
      BEGIN
        SELECT RAISE(ABORT, 'LING108 injected account pointer failure');
      END;`);

    expect(() =>
      executeAccountReplacementTransaction(db, USER_B, {
        installCompletedAt: INSTALL_AT,
      }),
    ).toThrow(/LING108 injected account pointer failure/);

    expect(snapshotState()).toEqual(before);
    expect(count('SELECT COUNT(*) AS c FROM sync_outbox')).toBe(1);
    expect(count('SELECT COUNT(*) AS c FROM flashcards')).toBeGreaterThan(0);
  });

  it('INV-003: rollback restores pre-attempt DB contents when pointer write never commits', () => {
    seedAccountAData();
    const flashcardCount = count('SELECT COUNT(*) AS c FROM flashcards');
    const outboxCount = count('SELECT COUNT(*) AS c FROM sync_outbox');

    db.raw.exec(`CREATE TRIGGER adv_ling108_fail_install_marker
      BEFORE INSERT ON app_settings
      WHEN NEW.key = '${INSTALL_MARKER_KEY}'
      BEGIN
        SELECT RAISE(ABORT, 'LING108 injected install marker failure');
      END;`);

    expect(() =>
      executeAccountReplacementTransaction(db, USER_B, {
        installCompletedAt: INSTALL_AT,
      }),
    ).toThrow(/LING108 injected install marker failure/);

    expect(readSetting('current_account_id')).toBe(USER_A);
    expect(count('SELECT COUNT(*) AS c FROM flashcards')).toBe(flashcardCount);
    expect(count('SELECT COUNT(*) AS c FROM sync_outbox')).toBe(outboxCount);
  });

  it('RISK-006: wipeDatabase rolls back when a delete step fails', () => {
    seedAccountAData();
    const before = snapshotState();

    db.raw.exec(`CREATE TRIGGER adv_ling108_fail_wipe
      BEFORE DELETE ON flashcards
      BEGIN
        SELECT RAISE(ABORT, 'LING108 injected wipe failure');
      END;`);

    expect(() => wipeDatabase(db)).toThrow(/LING108 injected wipe failure/);
    expect(snapshotState()).toEqual(before);
  });
});
