import type {QuickSQLiteConnection} from 'react-native-quick-sqlite';

import {clearLessonTokens} from '../security/lessonTokenStore';
import {getDatabase, withTransaction} from './database';

const CURRENT_ACCOUNT_ID_KEY = 'current_account_id';

export type ClearAllLocalDatabaseRowsOptions = {
  /**
   * Runs inside the wipe transaction after learner tables are cleared and
   * before `current_account_id` is restored (AD-007).
   */
  afterWipe?: (db: QuickSQLiteConnection) => void;
};

function readCurrentAccountId(db: QuickSQLiteConnection): string | null {
  const row = db
    .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [
      CURRENT_ACCOUNT_ID_KEY,
    ])
    .rows?.item(0) as {value?: string} | undefined;
  return row?.value ?? null;
}

function deleteLearnerOwnedRows(db: QuickSQLiteConnection): void {
  db.execute('DELETE FROM review_sessions;');
  db.execute('DELETE FROM review_schedule;');
  db.execute('DELETE FROM flashcards;');
  try {
    db.execute('DELETE FROM lessons;');
  } catch {
    // Table may be dropped after canonical legacy clear
  }
  db.execute('DELETE FROM gamification_events;');
  db.execute('DELETE FROM speaking_recordings;');
  db.execute('DELETE FROM speaking_attempts;');
  db.execute('DELETE FROM error_events;');
  db.execute('DELETE FROM sync_outbox;');
  db.execute('DELETE FROM audio_assets;');
  db.execute('DELETE FROM grammar_bookmarks;');
  try {
    db.execute('DELETE FROM lesson_v2;');
  } catch {
    // Table may be dropped after canonical legacy clear
  }
  for (const sql of [
    'DELETE FROM content_lesson_state;',
    'DELETE FROM youtube_sentences;',
    'DELETE FROM youtube_lessons;',
    'DELETE FROM youtube_progress;',
    'DELETE FROM practice_sets;',
    'DELETE FROM practice_questions;',
    'DELETE FROM practice_sessions;',
    'DELETE FROM practice_events;',
  ]) {
    try {
      db.execute(sql);
    } catch {
      // Retired tables (schema v3) may already be dropped.
    }
  }
  try {
    db.execute('DELETE FROM lesson_downloads;');
  } catch {
    // Table does not exist before the v2 cutover.
  }
  try {
    db.execute('DELETE FROM lesson_progress;');
  } catch {
    // Table does not exist before the v2 cutover.
  }
  db.execute('DELETE FROM app_settings;');
}

/**
 * Generic learner-data wipe, owned here (LING-48 / TASK-007) instead of
 * `LessonRepository` so `LocalDataDeletionService` ("delete my local data")
 * keeps working after the v1/v2 lesson repositories are removed (TASK-010).
 *
 * LING-224 AD-007: one transaction, optional `afterWipe`, keeps
 * `current_account_id` so sync drain ownership and tombstone push still work.
 */
export async function clearAllLocalDatabaseRows(
  options: ClearAllLocalDatabaseRowsOptions = {},
): Promise<void> {
  const db = getDatabase();
  const lessonIds = new Set<string>();
  for (const table of ['lessons', 'lesson_v2']) {
    try {
      const rows = db.execute(
        `SELECT ${
          table === 'lessons' ? 'id' : 'lesson_id'
        } AS lesson_id FROM ${table};`,
      ).rows;
      for (let index = 0; index < (rows?.length ?? 0); index += 1) {
        const row = rows?.item(index) as {lesson_id?: string} | undefined;
        if (row?.lesson_id) lessonIds.add(row.lesson_id);
      }
    } catch {
      // Older databases may not have the v2 table yet.
    }
  }
  const tokenCleanup = clearLessonTokens([...lessonIds]);

  withTransaction(db, () => {
    const preservedAccountId = readCurrentAccountId(db);
    deleteLearnerOwnedRows(db);
    options.afterWipe?.(db);
    if (preservedAccountId) {
      const now = new Date().toISOString();
      db.execute(
        'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
        [CURRENT_ACCOUNT_ID_KEY, preservedAccountId, now],
      );
    }
  });

  return tokenCleanup;
}
