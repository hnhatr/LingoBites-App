import {clearLessonTokens} from '../security/lessonTokenStore';
import {getDatabase} from './database';

/**
 * Generic learner-data wipe, owned here (LING-48 / TASK-007) instead of
 * `LessonRepository` so `LocalDataDeletionService` ("delete my local data")
 * keeps working after the v1/v2 lesson repositories are removed (TASK-010).
 *
 * Behavior is unchanged: clears lesson rows (v1 + v2), lesson security
 * tokens, and all unrelated learner-owned rows (flashcards, review,
 * content-package, YouTube, speaking, and supporting tables) listed below.
 * Flashcard/review/content-package/YouTube/speaking tables are wiped as
 * part of this explicit user-invoked deletion only — no table is dropped
 * and no other flow calls this function.
 *
 * LING-149 (EC-015/AC-015): canonical downloads (`lesson_downloads`) and
 * local progress (`lesson_progress`) are wiped here too. Media-file sweeping
 * for staged download files lands with TASK-007's media staging helper;
 * until then there is no on-disk media registry to clear.
 */
export async function clearAllLocalDatabaseRows(): Promise<void> {
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
  db.execute('DELETE FROM review_sessions;');
  db.execute('DELETE FROM review_schedule;');
  db.execute('DELETE FROM flashcards;');
  try {
    db.execute('DELETE FROM lessons;');
  } catch {
    // Table may be dropped after canonical legacy clear
  }
  db.execute('DELETE FROM app_settings;');
  db.execute('DELETE FROM gamification_events;');
  db.execute('DELETE FROM speaking_recordings;');
  db.execute('DELETE FROM error_events;');
  db.execute('DELETE FROM sync_outbox;');
  db.execute('DELETE FROM audio_assets;');
  db.execute('DELETE FROM content_review_items;');
  db.execute('DELETE FROM grammar_bookmarks;');
  db.execute('DELETE FROM content_lesson_state;');
  try {
    db.execute('DELETE FROM lesson_v2;');
  } catch {
    // Table may be dropped after canonical legacy clear
  }
  db.execute('DELETE FROM youtube_sentences;');
  db.execute('DELETE FROM youtube_lessons;');
  // LING-149 canonical state (tables may predate v2 on old databases).
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
  return tokenCleanup;
}
