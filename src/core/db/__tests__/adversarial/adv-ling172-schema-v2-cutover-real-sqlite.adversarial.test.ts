import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {resetDatabaseForTests} from '@core/db/database';
import {clearAllLocalDatabaseRows} from '@core/db/localDataWipe';
import {
  APP_SCHEMA_VERSION,
  readAppSchemaVersion,
  runMigrations,
} from '@core/db/migrations';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

/**
 * LING-172 (TASK-006): SQLite schema v2 cutover on a real engine (AD-008).
 * A database seeded with the pre-cutover schema migrates exactly once:
 * v2 tables appear, retired outbox rows are purged while live rows survive,
 * the v1 cursor is reset, and a second launch is a no-op.
 */

const OUTBOX_DDL = `CREATE TABLE sync_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  event_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  synced_at TEXT
);`;

const SETTINGS_DDL = `CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`;

const OLD_BOOKMARKS_DDL = `CREATE TABLE IF NOT EXISTS grammar_bookmarks (
  lesson_id TEXT NOT NULL,
  grammar_id TEXT NOT NULL,
  package_id TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  reactivated_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(lesson_id, grammar_id)
);`;

let dbFile: string;
let db: RealSqliteConnection;

function tableNames(): string[] {
  const rows = db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;",
  ).rows;
  const names: string[] = [];
  for (let i = 0; i < (rows?.length ?? 0); i += 1) {
    names.push((rows?.item(i) as {name: string}).name);
  }
  return names;
}

function columnNames(table: string): string[] {
  const rows = db.execute(`PRAGMA table_info(${table});`).rows;
  const names: string[] = [];
  for (let i = 0; i < (rows?.length ?? 0); i += 1) {
    names.push((rows?.item(i) as {name: string}).name);
  }
  return names;
}

function outboxIds(): string[] {
  const rows = db.execute('SELECT id FROM sync_outbox ORDER BY id;').rows;
  const ids: string[] = [];
  for (let i = 0; i < (rows?.length ?? 0); i += 1) {
    ids.push((rows?.item(i) as {id: string}).id);
  }
  return ids;
}

function seedOldDatabase(): void {
  db.execute(OUTBOX_DDL);
  db.execute(SETTINGS_DDL);
  db.execute(OLD_BOOKMARKS_DDL);
  const at = '2026-10-01T09:00:00.000Z';
  // Retired-collection row: purged at cutover.
  db.execute(
    `INSERT INTO sync_outbox (id, event_type, entity_id, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?);`,
    [
      'retired-1',
      'content_lesson_state',
      'lesson-old',
      JSON.stringify({isSaved: true}),
      at,
    ],
  );
  // Live transport row: survives.
  db.execute(
    `INSERT INTO sync_outbox (id, event_type, entity_id, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?);`,
    ['review-1', 'review', 'card-old', JSON.stringify({schema_version: 1}), at],
  );
  db.execute(
    "INSERT INTO app_settings (key, value, updated_at) VALUES ('sync_cursor', 'v1-cursor', ?);",
    [at],
  );
}

beforeEach(() => {
  dbFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'ling172-cutover-')),
    'lingobites.sqlite',
  );
  db = openRealSqlite(dbFile);
  resetDatabaseForTests(db);
});

afterEach(() => {
  try {
    db.close();
  } catch {
    // already closed by a restart step
  }
  resetDatabaseForTests(null);
  fs.rmSync(path.dirname(dbFile), {recursive: true, force: true});
});

describe('ADV / LING-172 schema v2 cutover on real SQLite', () => {
  it('migrates a seeded old schema exactly once', () => {
    seedOldDatabase();
    expect(readAppSchemaVersion(db)).toBe(0);

    runMigrations(db);

    expect(readAppSchemaVersion(db)).toBe(APP_SCHEMA_VERSION);
    expect(tableNames()).toEqual(
      expect.arrayContaining(['lesson_downloads', 'lesson_progress']),
    );
    expect(columnNames('grammar_bookmarks')).toEqual(
      expect.arrayContaining([
        'lesson_id',
        'grammar_id',
        'package_id',
        'name',
        'description',
        'formula',
        'analysis',
        'sentence_en',
      ]),
    );
    // Retired rows purged; live rows kept — including lesson_progress rows.
    db.execute(
      `INSERT INTO sync_outbox (id, event_type, entity_id, payload_json, created_at)
       VALUES ('progress-kept', 'lesson_progress', 'lesson-9', ?, ?);`,
      [JSON.stringify({event: 'start'}), '2026-10-01T09:01:00.000Z'],
    );
    runMigrations(db);
    expect(outboxIds()).toEqual(
      expect.arrayContaining(['review-1', 'progress-kept']),
    );
    expect(outboxIds()).not.toContain('retired-1');
    // v1 cursor reset.
    expect(
      db
        .execute(
          "SELECT COUNT(*) AS c FROM app_settings WHERE key = 'sync_cursor';",
        )
        .rows?.item(0),
    ).toMatchObject({c: 0});

    // Second launch: no-op, version stable, rows untouched.
    const before = outboxIds();
    runMigrations(db);
    expect(readAppSchemaVersion(db)).toBe(APP_SCHEMA_VERSION);
    expect(outboxIds()).toEqual(before);
    expect(tableNames()).toEqual(
      expect.arrayContaining(['lesson_downloads', 'lesson_progress']),
    );
  });

  it('EC-015: the local-data wipe clears downloads and progress', async () => {
    runMigrations(db);
    const at = '2026-10-01T09:00:00.000Z';
    db.execute(
      `INSERT INTO lesson_downloads (lesson_id, content_revision, contract_version, snapshot_json, downloaded_at)
       VALUES ('lesson-w', 3, 1, ?, ?);`,
      [JSON.stringify({lesson: 'w'}), at],
    );
    db.execute(
      `INSERT INTO lesson_progress (lesson_id, status, started_at, completed_at, updated_at)
       VALUES ('lesson-w', 'completed', ?, ?, ?);`,
      [at, at, at],
    );

    await clearAllLocalDatabaseRows();

    expect(
      (
        db
          .execute('SELECT COUNT(*) AS c FROM lesson_downloads;')
          .rows?.item(0) as {c: number}
      ).c,
    ).toBe(0);
    expect(
      (
        db
          .execute('SELECT COUNT(*) AS c FROM lesson_progress;')
          .rows?.item(0) as {c: number}
      ).c,
    ).toBe(0);
    // The wipe is data-only: the schema stays at v2.
    expect(readAppSchemaVersion(db)).toBe(APP_SCHEMA_VERSION);
  });
});
