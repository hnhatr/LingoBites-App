import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  readAppSchemaVersion,
  runMigrationsThroughSchemaV3,
  runMigrationsThroughSchemaV4,
} from '@core/db/migrations';
import {APP_SCHEMA_VERSION_V4, ensureSchemaV4Upgrade} from '@core/db/schemaV4';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

const RETIRED_TABLE_NAMES = [
  'practice_sets',
  'youtube_lessons',
  'content_review_items',
  'content_lesson_state',
];

let dbDirectory: string;
let dbFile: string;
let db: RealSqliteConnection;

function tableNames(connection = db): string[] {
  const rows = connection.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;",
  ).rows;
  return (rows?._array ?? []).map(row => String(row.name));
}

function indexNames(connection = db): string[] {
  const rows = connection.execute(
    "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name;",
  ).rows;
  return (rows?._array ?? []).map(row => String(row.name));
}

function columnNames(table: string, connection = db): string[] {
  const rows = connection.execute(`PRAGMA table_info(${table});`).rows;
  return (rows?._array ?? []).map(row => String(row.name));
}

function recordingRows(connection = db): Array<Record<string, unknown>> {
  return (connection.execute('SELECT * FROM speaking_recordings ORDER BY id;')
    .rows?._array ?? []) as Array<Record<string, unknown>>;
}

function seedV3Recordings(): void {
  runMigrationsThroughSchemaV3(db);
  db.execute(
    `INSERT INTO speaking_recordings
      (id, activity_id, lesson_id, mode, file_path, duration_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?);`,
    [
      'recording-a',
      null,
      'lesson-a',
      'shadowing',
      '/recordings/a.m4a',
      1234,
      '2026-10-01T00:00:00.000Z',
      'recording-b',
      'activity-b',
      'lesson-b',
      'quick_answer',
      '/recordings/b.m4a',
      5678,
      '2026-10-02T00:00:00.000Z',
    ],
  );
}

beforeEach(() => {
  dbDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ling235-adversarial-'));
  dbFile = path.join(dbDirectory, 'lingobites.sqlite');
  db = openRealSqlite(dbFile);
});

afterEach(() => {
  try {
    db.close();
  } catch {
    // already closed
  }
  fs.rmSync(dbDirectory, {recursive: true, force: true});
});

describe('LING-235 schema v4 adversarial review (real SQLite)', () => {
  it('ADV-001 / INV-P2: the v3-to-v4 entry point is a no-op unless user_version is exactly 3', () => {
    const observed = [0, 1, 2, 4, 5].map(version => {
      db.execute(`PRAGMA user_version = ${version};`);
      let error: string | null = null;
      try {
        ensureSchemaV4Upgrade(db);
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
      }
      return {
        requestedVersion: version,
        resultingVersion: readAppSchemaVersion(db),
        tables: tableNames(),
        error,
      };
    });

    expect(observed).toEqual(
      [0, 1, 2, 4, 5].map(version => ({
        requestedVersion: version,
        resultingVersion: version,
        tables: [],
        error: null,
      })),
    );
  });

  it('H1 / INV-P1: an injected mid-DDL failure rolls back every column and the version before a clean retry', () => {
    seedV3Recordings();
    const beforeRows = recordingRows();
    const beforeIndexes = indexNames();

    const failingConnection = Object.create(db) as RealSqliteConnection;
    failingConnection.execute = (sql, params) => {
      if (/CREATE TABLE IF NOT EXISTS speaking_attempts/i.test(sql)) {
        throw new Error('H1 injected failure after speaking_recordings ALTERs');
      }
      return db.execute(sql, params);
    };

    expect(() => ensureSchemaV4Upgrade(failingConnection)).toThrow(
      'H1 injected failure',
    );
    expect(readAppSchemaVersion(db)).toBe(3);
    expect(columnNames('speaking_recordings')).not.toContain('sentence_id');
    expect(recordingRows()).toEqual(beforeRows);
    expect(indexNames()).toEqual(beforeIndexes);

    db.close();
    db = openRealSqlite(dbFile);
    expect(readAppSchemaVersion(db)).toBe(3);
    expect(() => ensureSchemaV4Upgrade(db)).not.toThrow();
    expect(readAppSchemaVersion(db)).toBe(APP_SCHEMA_VERSION_V4);
    expect(recordingRows()).toEqual(
      beforeRows.map(row => ({
        ...row,
        owner_user_id: null,
        sentence_id: null,
        server_recording_id: null,
        upload_attempts: 0,
        upload_error: null,
        upload_next_at: null,
        upload_state: 'local_only',
      })),
    );
  });

  it('H3 / INV-P1: a competing connection lock leaves the v3 database unchanged and retryable', () => {
    seedV3Recordings();
    const beforeRows = recordingRows();
    const competing = openRealSqlite(dbFile);
    try {
      db.execute('BEGIN IMMEDIATE');
      expect(() => ensureSchemaV4Upgrade(competing)).toThrow(/locked/i);
      expect(readAppSchemaVersion(competing)).toBe(3);
      expect(columnNames('speaking_recordings', competing)).not.toContain(
        'sentence_id',
      );
      db.execute('ROLLBACK');

      expect(() => ensureSchemaV4Upgrade(competing)).not.toThrow();
      expect(readAppSchemaVersion(competing)).toBe(APP_SCHEMA_VERSION_V4);
      expect(recordingRows(competing)).toEqual(
        beforeRows.map(row => ({
          ...row,
          owner_user_id: null,
          sentence_id: null,
          server_recording_id: null,
          upload_attempts: 0,
          upload_error: null,
          upload_next_at: null,
          upload_state: 'local_only',
        })),
      );
    } finally {
      try {
        db.execute('ROLLBACK');
      } catch {
        // no active transaction
      }
      competing.close();
    }
  });

  it('H4 / INV-P3: upgrading preserves all v3 rows and legacy indexes while adding the v4 indexes', () => {
    seedV3Recordings();
    const beforeRows = recordingRows();
    const beforeIndexes = indexNames();

    ensureSchemaV4Upgrade(db);

    expect(recordingRows()).toEqual(
      beforeRows.map(row => ({
        ...row,
        owner_user_id: null,
        sentence_id: null,
        server_recording_id: null,
        upload_attempts: 0,
        upload_error: null,
        upload_next_at: null,
        upload_state: 'local_only',
      })),
    );
    expect(indexNames()).toEqual(
      expect.arrayContaining([
        ...beforeIndexes,
        'idx_speaking_recordings_mode_sentence_id',
        'idx_speaking_recordings_upload_state_upload_next_at',
        'idx_speaking_attempts_lesson_practiced_at',
      ]),
    );
  });

  it('H5 / INV-P2: a real v3 cutover never replays the legacy baseline before v4', () => {
    runMigrationsThroughSchemaV3(db);
    expect(readAppSchemaVersion(db)).toBe(3);
    for (const table of RETIRED_TABLE_NAMES) {
      expect(tableNames()).not.toContain(table);
    }

    runMigrationsThroughSchemaV4(db);

    expect(readAppSchemaVersion(db)).toBe(APP_SCHEMA_VERSION_V4);
    for (const table of RETIRED_TABLE_NAMES) {
      expect(tableNames()).not.toContain(table);
    }
  });
});
