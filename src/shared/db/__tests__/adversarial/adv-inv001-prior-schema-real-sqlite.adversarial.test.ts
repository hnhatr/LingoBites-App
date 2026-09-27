import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {getDatabase, resetDatabaseForTests} from '../../database';
import {listFlashcards, recordFlashcardRating} from '../../FlashcardRepository';
import {getYouTubeProgress} from '../../YouTubeProgressRepository';
import {getContentLessonState} from '../../ContentLessonStateRepository';
import {listBookmarkedGrammar} from '../../GrammarBookmarkRepository';
import {listPendingSyncEvents} from '@modules/sync/adapters/SyncOutboxRepository';
import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@/test-support/adversarial/realSqlite';
import {PRIOR_SCHEMA_403BC52} from '@/test-support/adversarial/priorSchema403bc52';

/**
 * LING-93 adversarial review (INV-001 / HC-006). A real SQLite file is created
 * with the schema shipped at 403bc52 (before the SETE-298 ALTER TABLE
 * revision/tombstone columns), seeded with learner rows, then upgraded by the
 * CURRENT production `runMigrations` through the production `getDatabase()`
 * cold-start path and read back through production repositories.
 */

const T0 = '2026-09-10T08:00:00.000Z';

function seedPriorInstall(raw: RealSqliteConnection) {
  for (const sql of PRIOR_SCHEMA_403BC52) {
    try {
      raw.execute(sql);
    } catch (error) {
      if (!String((error as Error).message).includes('duplicate column')) {
        throw error;
      }
    }
  }
  const exec = (sql: string, params: unknown[]) =>
    raw.execute(sql, params as never[]);
  exec(
    `INSERT INTO flashcards (id, lesson_id, vocabulary_id, word, meaning_vi,
      is_saved, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    ['card-prior', 'lesson-prior', 'voc-1', 'apple', 'quả táo', T0, T0],
  );
  exec(
    `INSERT INTO review_schedule (card_id, lesson_id, interval_days,
      next_review_at, last_reviewed_at, created_at, updated_at)
      VALUES (?, ?, 3, ?, ?, ?, ?)`,
    ['card-prior', 'lesson-prior', '2026-09-13T08:00:00.000Z', T0, T0, T0],
  );
  exec(
    `INSERT INTO sync_outbox (id, event_type, entity_id, payload_json,
      created_at, attempt_count, last_error, synced_at)
      VALUES (?, 'review', ?, ?, ?, 2, 'NETWORK_ERROR', NULL)`,
    [
      'outbox-prior',
      'card-prior',
      JSON.stringify({schema_version: 1, card_id: 'card-prior'}),
      T0,
    ],
  );
  exec(
    `INSERT INTO youtube_progress (lesson_id, position_ms, segment_index,
      updated_at) VALUES (?, 81234, 7, ?)`,
    ['yt-prior', T0],
  );
  exec(
    `INSERT INTO content_lesson_state (lesson_id, is_saved, is_started,
      created_at, updated_at) VALUES (?, 1, 1, ?, ?)`,
    ['content-prior', T0, T0],
  );
  exec(
    `INSERT INTO grammar_bookmarks (lesson_id, grammar_id, package_id,
      saved_at, reactivated_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['content-prior', 'gr-1', 'pkg-1', T0, T0, T0, T0],
  );
}

let dir: string;
let dbFile: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ling93-adv-inv001-'));
  dbFile = path.join(dir, 'lingobites.sqlite');
  const prior = openRealSqlite(dbFile);
  seedPriorInstall(prior);
  prior.close();
});

afterEach(() => {
  resetDatabaseForTests(null);
  fs.rmSync(dir, {recursive: true, force: true});
});

function coldStart(): RealSqliteConnection {
  const connection = openRealSqlite(dbFile);
  // Production cold start: getDatabase() runs runMigrations once.
  resetDatabaseForTests(connection);
  getDatabase();
  return connection;
}

describe('ADV / INV-001 prior-schema upgrade on real SQLite (403bc52 → head)', () => {
  it('ADV-H05 / INV-001: learner rows persisted on the prior schema stay readable and unchanged after the production upgrade', () => {
    const db = coldStart();

    expect(listFlashcards()).toEqual([
      expect.objectContaining({
        id: 'card-prior',
        lessonId: 'lesson-prior',
        word: 'apple',
        meaningVi: 'quả táo',
      }),
    ]);
    expect(getYouTubeProgress('yt-prior')).toMatchObject({
      lessonId: 'yt-prior',
      positionMs: 81234,
      segmentIndex: 7,
    });
    expect(getContentLessonState('content-prior')).toMatchObject({
      isSaved: true,
      isStarted: true,
    });
    expect(listBookmarkedGrammar('content-prior')).toHaveLength(1);
    expect(listPendingSyncEvents()).toEqual([
      expect.objectContaining({
        id: 'outbox-prior',
        attemptCount: 2,
        syncedAt: null,
      }),
    ]);

    // New columns are backfilled with defaults, not NULL.
    expect(
      db
        .execute(
          "SELECT revision, tombstone FROM youtube_progress WHERE lesson_id = 'yt-prior'",
        )
        .rows?.item(0),
    ).toEqual({revision: 0, tombstone: 0});

    // A second cold start (migrations re-run) keeps everything and the
    // upgraded schema still accepts a production review write.
    db.close();
    coldStart();
    expect(getYouTubeProgress('yt-prior')?.positionMs).toBe(81234);
    expect(
      recordFlashcardRating({
        flashcardId: 'card-prior',
        rating: 'remembered',
        reviewedAt: '2026-09-27T08:00:00.000Z',
      }),
    ).toMatchObject({ok: true});
    expect(listPendingSyncEvents()).toHaveLength(2);
  });
});
