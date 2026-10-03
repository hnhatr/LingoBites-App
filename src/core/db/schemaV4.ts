import type {QuickSQLiteConnection} from 'react-native-quick-sqlite';

function readLocalSchemaVersion(db: QuickSQLiteConnection): number {
  try {
    const rows = db.execute('PRAGMA user_version;').rows;
    const value = (rows?.item(0) as {user_version?: unknown} | undefined)
      ?.user_version;
    const parsed = typeof value === 'number' ? value : Number(value ?? 0);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  } catch {
    return 0;
  }
}

/** Schema v3 is frozen; the v3 upgrade gate must not track `APP_SCHEMA_VERSION`. */
export const APP_SCHEMA_VERSION_V3 = 3;

export const APP_SCHEMA_VERSION_V4 = 4;

const SPEAKING_RECORDINGS_V4_COLUMNS: string[] = [
  'ADD COLUMN sentence_id TEXT',
  'ADD COLUMN owner_user_id TEXT',
  "ADD COLUMN upload_state TEXT NOT NULL DEFAULT 'local_only'",
  'ADD COLUMN upload_attempts INTEGER NOT NULL DEFAULT 0',
  'ADD COLUMN upload_next_at TEXT',
  'ADD COLUMN upload_error TEXT',
  'ADD COLUMN server_recording_id TEXT',
];

const SCHEMA_V4_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS speaking_attempts (
    id TEXT PRIMARY KEY NOT NULL,
    lesson_id TEXT NOT NULL,
    sentence_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    practiced_at TEXT NOT NULL,
    check_full_sentence INTEGER NOT NULL,
    check_key_words INTEGER NOT NULL,
    check_rhythm INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    recording_id TEXT,
    revision INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_speaking_recordings_mode_sentence_id
    ON speaking_recordings (mode, sentence_id);`,
  `CREATE INDEX IF NOT EXISTS idx_speaking_recordings_upload_state_upload_next_at
    ON speaking_recordings (upload_state, upload_next_at);`,
  `CREATE INDEX IF NOT EXISTS idx_speaking_attempts_lesson_practiced_at
    ON speaking_attempts (lesson_id, practiced_at DESC);`,
];

function ignoreBenignSchemaError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('duplicate column name') ||
      error.message.includes('no such table'))
  );
}

/**
 * LING-224 / FR-016: sentence-linked recordings and `speaking_attempts`.
 * Runs only when `user_version` is exactly 3; v4+ and pre-v3 databases are untouched.
 */
export function ensureSchemaV4Upgrade(db: QuickSQLiteConnection): void {
  const version = readLocalSchemaVersion(db);
  if (version !== APP_SCHEMA_VERSION_V3) {
    return;
  }
  db.execute('BEGIN');
  try {
    for (const column of SPEAKING_RECORDINGS_V4_COLUMNS) {
      try {
        db.execute(`ALTER TABLE speaking_recordings ${column};`);
      } catch (error) {
        if (!ignoreBenignSchemaError(error)) {
          throw error;
        }
      }
    }
    for (const sql of SCHEMA_V4_STATEMENTS) {
      db.execute(sql);
    }
    db.execute(`PRAGMA user_version = ${APP_SCHEMA_VERSION_V4};`);
    db.execute('COMMIT');
  } catch (error) {
    try {
      db.execute('ROLLBACK');
    } catch {
      // Rollback failure leaves the connection unusable; surface the original error.
    }
    throw error;
  }
}
