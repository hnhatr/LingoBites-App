import type {QuickSQLiteConnection} from 'react-native-quick-sqlite';

import {vocabularyItemKey} from '../learning/itemKey';
import {APP_SCHEMA_VERSION_V4} from './schemaV4';

/**
 * Schema v5 (learning items): one flashcard per lemma across lessons, the
 * `flashcard_sources` link, and `activity_attempts`.
 *
 * Design, merge rules and rollback:
 * `docs/architecture/schema-v5-learning-items-migration.md`.
 */
export const APP_SCHEMA_VERSION_V5 = 5;

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

const SCHEMA_V5_COLUMNS: Array<{table: string; column: string}> = [
  {table: 'flashcards', column: 'item_key TEXT'},
  {table: 'grammar_bookmarks', column: 'item_key TEXT'},
];

const SCHEMA_V5_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS flashcard_sources (
    card_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    source_sentence TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (card_id, lesson_id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_flashcard_sources_lesson
    ON flashcard_sources (lesson_id);`,
  `CREATE TABLE IF NOT EXISTS activity_attempts (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL,
    activity TEXT NOT NULL,
    lesson_id TEXT,
    item_key TEXT,
    session_id TEXT,
    result TEXT NOT NULL,
    score REAL,
    duration_ms INTEGER NOT NULL,
    occurred_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    tombstone INTEGER NOT NULL DEFAULT 0
  );`,
  `CREATE INDEX IF NOT EXISTS idx_activity_attempts_lesson
    ON activity_attempts (lesson_id, occurred_at DESC);`,
  // Kept for one release so a bad merge can be repaired by hand.
  `CREATE TABLE IF NOT EXISTS flashcards_v4_backup AS SELECT * FROM flashcards;`,
  `CREATE TABLE IF NOT EXISTS review_schedule_v4_backup AS SELECT * FROM review_schedule;`,
];

/** Created only after duplicates are merged, so it can never fail the merge. */
const LIVE_ITEM_KEY_INDEX = `CREATE UNIQUE INDEX IF NOT EXISTS idx_flashcards_item_key_live
    ON flashcards (item_key)
    WHERE item_key IS NOT NULL AND tombstone = 0;`;

/** Tables the v5 upgrade adds; every one holds learner data (wipe list). */
export const SCHEMA_V5_TABLES = [
  'flashcard_sources',
  'activity_attempts',
  'flashcards_v4_backup',
  'review_schedule_v4_backup',
] as const;

/**
 * Support/test rollback: drops what v5 added and returns to `user_version = 4`.
 * The `item_key` columns stay (SQLite cannot always `DROP COLUMN`); they are
 * ignored by v4 code. Restoring merged cards from `flashcards_v4_backup` is a
 * manual repair.
 */
export const SCHEMA_V5_DOWN_STATEMENTS: string[] = [
  `DROP INDEX IF EXISTS idx_flashcards_item_key_live;`,
  `DROP INDEX IF EXISTS idx_activity_attempts_lesson;`,
  `DROP INDEX IF EXISTS idx_flashcard_sources_lesson;`,
  `DROP TABLE IF EXISTS activity_attempts;`,
  `DROP TABLE IF EXISTS flashcard_sources;`,
  `PRAGMA user_version = ${APP_SCHEMA_VERSION_V4};`,
];

function ignoreBenignSchemaError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.includes('duplicate column name')
  );
}

type CardRow = {
  id: string;
  lesson_id: string;
  word: string;
  source_sentence: string | null;
  is_saved: number;
  created_at: string;
  interval_days: number;
};

function readCards(db: QuickSQLiteConnection): CardRow[] {
  const result = db.execute(
    `SELECT f.id, f.lesson_id, f.word, f.source_sentence, f.is_saved,
            f.created_at, COALESCE(rs.interval_days, 0) AS interval_days
       FROM flashcards f
       LEFT JOIN review_schedule rs ON rs.card_id = f.id
      WHERE COALESCE(f.tombstone, 0) = 0;`,
  );
  const cards: CardRow[] = [];
  for (let index = 0; index < (result.rows?.length ?? 0); index += 1) {
    cards.push(result.rows!.item(index) as CardRow);
  }
  return cards;
}

/** Winner first: saved, furthest review interval, oldest, then smallest id. */
function compareForWinner(a: CardRow, b: CardRow): number {
  if (a.is_saved !== b.is_saved) {
    return b.is_saved - a.is_saved;
  }
  if (a.interval_days !== b.interval_days) {
    return b.interval_days - a.interval_days;
  }
  if (a.created_at !== b.created_at) {
    return a.created_at < b.created_at ? -1 : 1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function mergeFlashcardsByItemKey(
  db: QuickSQLiteConnection,
  now: string,
): void {
  const groups = new Map<string, CardRow[]>();
  for (const card of readCards(db)) {
    const itemKey = vocabularyItemKey(card.word);
    if (itemKey === null) {
      continue; // nothing usable to key on: leave the card exactly as it is
    }
    db.execute('UPDATE flashcards SET item_key = ? WHERE id = ?;', [
      itemKey,
      card.id,
    ]);
    const group = groups.get(itemKey);
    if (group) {
      group.push(card);
    } else {
      groups.set(itemKey, [card]);
    }
  }

  for (const cards of groups.values()) {
    const ordered = [...cards].sort(compareForWinner);
    // Saved cards sort first, so the winner is saved whenever any twin was.
    const winner = ordered[0]!;
    for (const loser of ordered.slice(1)) {
      db.execute(
        'UPDATE flashcards SET tombstone = 1, is_saved = 0, updated_at = ? WHERE id = ?;',
        [now, loser.id],
      );
    }
    for (const card of cards) {
      db.execute(
        `INSERT OR IGNORE INTO flashcard_sources (
          card_id, lesson_id, source_sentence, created_at
        ) VALUES (?, ?, ?, ?);`,
        [winner.id, card.lesson_id, card.source_sentence, card.created_at],
      );
    }
  }
}

/**
 * Runs only when `user_version` is exactly 4; v5+ and older databases are
 * untouched. One transaction: any error rolls back and leaves version 4.
 */
export function ensureSchemaV5Upgrade(
  db: QuickSQLiteConnection,
  now: string = new Date().toISOString(),
): void {
  if (readLocalSchemaVersion(db) !== APP_SCHEMA_VERSION_V4) {
    return;
  }
  db.execute('BEGIN');
  try {
    for (const {table, column} of SCHEMA_V5_COLUMNS) {
      try {
        db.execute(`ALTER TABLE ${table} ADD COLUMN ${column};`);
      } catch (error) {
        if (!ignoreBenignSchemaError(error)) {
          throw error;
        }
      }
    }
    for (const sql of SCHEMA_V5_STATEMENTS) {
      db.execute(sql);
    }
    mergeFlashcardsByItemKey(db, now);
    db.execute(LIVE_ITEM_KEY_INDEX);
    db.execute(`PRAGMA user_version = ${APP_SCHEMA_VERSION_V5};`);
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
