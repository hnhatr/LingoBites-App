import type {QuickSQLiteConnection} from 'react-native-quick-sqlite';

import {APP_SCHEMA_VERSION_V5} from './schemaV5';

/**
 * Schema v6 (lesson bookmarks): the learner's "save for later" list, synced
 * through the `lesson_bookmarks` collection.
 *
 * One row per lesson. Unsaving keeps the row with `tombstone = 1` so a pulled
 * record can be compared by time against the local change (last writer wins).
 * The card columns let a saved lesson be drawn before it is downloaded.
 */
export const APP_SCHEMA_VERSION_V6 = 6;

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

const SCHEMA_V6_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS lesson_bookmarks (
    lesson_id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    source_type TEXT NOT NULL,
    sentence_count INTEGER NOT NULL DEFAULT 0,
    estimated_minutes INTEGER,
    context_label TEXT,
    saved_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    tombstone INTEGER NOT NULL DEFAULT 0
  );`,
  `CREATE INDEX IF NOT EXISTS idx_lesson_bookmarks_saved
    ON lesson_bookmarks (tombstone, saved_at DESC);`,
];

/** Tables the v6 upgrade adds; every one holds learner data (wipe list). */
export const SCHEMA_V6_TABLES = ['lesson_bookmarks'] as const;

/** Support/test rollback: drops what v6 added and returns to version 5. */
export const SCHEMA_V6_DOWN_STATEMENTS: string[] = [
  `DROP INDEX IF EXISTS idx_lesson_bookmarks_saved;`,
  `DROP TABLE IF EXISTS lesson_bookmarks;`,
  `PRAGMA user_version = ${APP_SCHEMA_VERSION_V5};`,
];

/**
 * Runs only when `user_version` is exactly 5; other versions are untouched.
 * One transaction: any error rolls back and leaves version 5.
 */
export function ensureSchemaV6Upgrade(db: QuickSQLiteConnection): void {
  if (readLocalSchemaVersion(db) !== APP_SCHEMA_VERSION_V5) {
    return;
  }
  db.execute('BEGIN');
  try {
    for (const sql of SCHEMA_V6_STATEMENTS) {
      db.execute(sql);
    }
    db.execute(`PRAGMA user_version = ${APP_SCHEMA_VERSION_V6};`);
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
