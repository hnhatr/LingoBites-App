import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  APP_SCHEMA_VERSION,
  APP_SCHEMA_VERSION_V3,
  readAppSchemaVersion,
  runMigrations,
  runMigrationsThroughSchemaV3,
} from '@core/db/migrations';
import {APP_SCHEMA_VERSION_V4} from '@core/db/schemaV4';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

const LEGACY_RECORDING_ID = 'rec-v3-legacy';
const LEGACY_CREATED_AT = '2026-01-01T00:00:00.000Z';

const V4_INDEX_NAMES = [
  'idx_speaking_recordings_mode_sentence_id',
  'idx_speaking_recordings_upload_state_upload_next_at',
  'idx_speaking_attempts_lesson_practiced_at',
];

const SPEAKING_RECORDINGS_V4_COLUMNS = [
  'sentence_id',
  'owner_user_id',
  'upload_state',
  'upload_attempts',
  'upload_next_at',
  'upload_error',
  'server_recording_id',
];

let dbFile: string;
let db: RealSqliteConnection;

function indexNames(): string[] {
  const rows = db.execute(
    "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name;",
  ).rows;
  const names: string[] = [];
  for (let i = 0; i < (rows?.length ?? 0); i += 1) {
    names.push((rows?.item(i) as {name: string}).name);
  }
  return names;
}

function tableColumnNames(table: string): string[] {
  const rows = db.execute(`PRAGMA table_info(${table});`).rows;
  const names: string[] = [];
  for (let i = 0; i < (rows?.length ?? 0); i += 1) {
    names.push((rows?.item(i) as {name: string}).name);
  }
  return names;
}

function insertLegacySpeakingRecording(): void {
  db.execute(
    `INSERT INTO speaking_recordings (
      id, activity_id, lesson_id, mode, file_path, duration_ms, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      LEGACY_RECORDING_ID,
      null,
      'lesson-1',
      'shadowing',
      '/tmp/legacy.m4a',
      1200,
      LEGACY_CREATED_AT,
    ],
  );
}

function legacyRecordingRow(): Record<string, unknown> | undefined {
  const rows = db.execute('SELECT * FROM speaking_recordings WHERE id = ?;', [
    LEGACY_RECORDING_ID,
  ]).rows;
  return rows?.length ? (rows.item(0) as Record<string, unknown>) : undefined;
}

function snapshotSchemaFingerprint(): string {
  const tables = db.execute(
    "SELECT name, sql FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY name, type;",
  ).rows;
  const parts: string[] = [];
  for (let i = 0; i < (tables?.length ?? 0); i += 1) {
    const row = tables?.item(i) as {name: string; sql: string | null};
    parts.push(`${row.name}:${row.sql ?? ''}`);
  }
  return parts.join('\n');
}

function assertSchemaV4Shape(): void {
  expect(readAppSchemaVersion(db)).toBe(APP_SCHEMA_VERSION_V4);
  expect(APP_SCHEMA_VERSION).toBe(APP_SCHEMA_VERSION_V4);

  const recordingColumns = tableColumnNames('speaking_recordings');
  for (const column of SPEAKING_RECORDINGS_V4_COLUMNS) {
    expect(recordingColumns).toContain(column);
  }

  const attemptColumns = tableColumnNames('speaking_attempts');
  expect(attemptColumns).toEqual(
    expect.arrayContaining([
      'id',
      'lesson_id',
      'sentence_id',
      'mode',
      'practiced_at',
      'check_full_sentence',
      'check_key_words',
      'check_rhythm',
      'duration_ms',
      'recording_id',
      'revision',
      'updated_at',
    ]),
  );

  const indexes = indexNames();
  for (const name of V4_INDEX_NAMES) {
    expect(indexes).toContain(name);
  }

  const uploadInfo = db.execute('PRAGMA table_info(speaking_recordings);').rows;
  let uploadStateDefault: unknown;
  for (let i = 0; i < (uploadInfo?.length ?? 0); i += 1) {
    const col = uploadInfo?.item(i) as {name: string; dflt_value: unknown};
    if (col.name === 'upload_state') {
      uploadStateDefault = col.dflt_value;
    }
  }
  expect(uploadStateDefault).toBe("'local_only'");

  const revisionInfo = db.execute('PRAGMA table_info(speaking_attempts);').rows;
  let revisionDefault: unknown;
  for (let i = 0; i < (revisionInfo?.length ?? 0); i += 1) {
    const col = revisionInfo?.item(i) as {name: string; dflt_value: unknown};
    if (col.name === 'revision') {
      revisionDefault = col.dflt_value;
    }
  }
  expect(revisionDefault).toBe('0');
}

beforeEach(() => {
  dbFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'ling235-schema-v4-')),
    'lingobites.sqlite',
  );
  db = openRealSqlite(dbFile);
});

afterEach(() => {
  try {
    db.close();
  } catch {
    // already closed
  }
  fs.rmSync(path.dirname(dbFile), {recursive: true, force: true});
});

describe('LING-235 / AC-016 schema v4 on real SQLite', () => {
  it('upgrades a v3 database with legacy speaking rows exactly once', () => {
    runMigrationsThroughSchemaV3(db);
    expect(readAppSchemaVersion(db)).toBe(APP_SCHEMA_VERSION_V3);
    insertLegacySpeakingRecording();

    runMigrations(db);
    assertSchemaV4Shape();

    const row = legacyRecordingRow();
    expect(row).toMatchObject({
      id: LEGACY_RECORDING_ID,
      lesson_id: 'lesson-1',
      mode: 'shadowing',
      file_path: '/tmp/legacy.m4a',
      duration_ms: 1200,
      created_at: LEGACY_CREATED_AT,
      sentence_id: null,
      owner_user_id: null,
      upload_state: 'local_only',
      upload_attempts: 0,
      upload_next_at: null,
      upload_error: null,
      server_recording_id: null,
    });

    const fingerprintAfterFirst = snapshotSchemaFingerprint();
    runMigrations(db);
    assertSchemaV4Shape();
    expect(snapshotSchemaFingerprint()).toBe(fingerprintAfterFirst);
    expect(legacyRecordingRow()).toEqual(row);
  });

  it('leaves a database already at v4 unchanged on re-run', () => {
    runMigrations(db);
    assertSchemaV4Shape();
    const fingerprint = snapshotSchemaFingerprint();

    runMigrations(db);
    expect(readAppSchemaVersion(db)).toBe(APP_SCHEMA_VERSION_V4);
    expect(snapshotSchemaFingerprint()).toBe(fingerprint);
  });

  it('runs the v3 gate at literal version 3 before advancing to v4', () => {
    runMigrationsThroughSchemaV3(db);
    expect(readAppSchemaVersion(db)).toBe(3);
    expect(tableColumnNames('speaking_recordings')).not.toContain(
      'sentence_id',
    );

    runMigrations(db);
    expect(readAppSchemaVersion(db)).toBe(4);
    expect(tableColumnNames('speaking_recordings')).toContain('sentence_id');
  });
});
