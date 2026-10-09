import {readFileSync} from 'fs';
import {join} from 'path';

import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {ActivityAttemptPayloadSchema} from '@core/schemas/sync';
import {getItemMemory} from '@core/sync/learningOutcomes';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {getDueFlashcards, saveFlashcard} from '../FlashcardRepository';
import {
  DAILY_ITEM_REVIEW_LIMIT,
  itemReviewQueue,
  itemReviewsDoneToday,
  recordItemReview,
  startOfVietnamDay,
} from '../itemReview';

/** PR 16: lesson items on the Server's review schedule (G7–G10). */
const snapshotJson = readFileSync(
  join(
    __dirname,
    '../../../../core/schemas/__tests__/fixtures/valid-lesson-snapshot-with-spec-response.json',
  ),
  'utf8',
);
const NOW = new Date('2026-10-09T10:00:00.000Z');

function download() {
  getDatabase().execute(
    `INSERT INTO lesson_downloads (lesson_id, content_revision, server_revision,
       contract_version, snapshot_json, media_dir, downloaded_at)
     VALUES ('5739bc5c-e509-4f57-a082-f9184fa9f882', 1, 1, 2, ?, NULL, ?);`,
    [snapshotJson, NOW.toISOString()],
  );
}

function schedule(code: string, dueAt: string, stage = 0) {
  getDatabase().execute(
    `INSERT INTO item_memory (item_code, stage, due_at, stable_at, last_result,
       last_reviewed_at, updated_at) VALUES (?, ?, ?, NULL, NULL, NULL, ?);`,
    [code, stage, dueAt, dueAt],
  );
}

beforeEach(() => {
  const db = openRealSqlite();
  resetDatabaseForTests(db);
  runMigrations(db);
});

afterEach(() => {
  resetDatabaseForTests(null);
});

it('counts days from midnight in Vietnam', () => {
  expect(
    startOfVietnamDay(new Date('2026-10-09T16:59:00.000Z')).toISOString(),
  ).toBe('2026-10-08T17:00:00.000Z');
  expect(
    startOfVietnamDay(new Date('2026-10-09T17:00:00.000Z')).toISOString(),
  ).toBe('2026-10-09T17:00:00.000Z');
});

it('lists due items with their content, the longest overdue first (B8)', () => {
  download();
  schedule('word:tea', '2026-10-08T00:00:00.000Z');
  schedule('word:coffee', '2026-10-01T00:00:00.000Z');
  schedule('word:milk', '2026-10-20T00:00:00.000Z');
  schedule('word:gone', '2026-10-02T00:00:00.000Z');

  const queue = itemReviewQueue(NOW);
  expect(queue.items.map(entry => entry.item.code)).toEqual([
    'word:coffee',
    'word:tea',
  ]);
  expect(queue.items[0]!.item.meaning_vi).toBe('cà phê');
  expect(queue.missing).toBe(1);
});

it('keeps to 20 reviews a day', () => {
  download();
  schedule('word:tea', '2026-10-08T00:00:00.000Z');
  for (let i = 0; i < DAILY_ITEM_REVIEW_LIMIT - 1; i += 1) {
    recordItemReview({
      itemCode: 'word:milk',
      result: 'correct',
      durationMs: 1000,
      now: NOW,
    });
  }
  expect(itemReviewsDoneToday(NOW)).toBe(DAILY_ITEM_REVIEW_LIMIT - 1);
  expect(itemReviewQueue(NOW).items).toHaveLength(1);
  recordItemReview({
    itemCode: 'word:milk',
    result: 'correct',
    durationMs: 1000,
    now: NOW,
  });
  expect(itemReviewQueue(NOW).items).toHaveLength(0);
  expect(
    itemReviewQueue(new Date('2026-10-10T10:00:00.000Z')).items,
  ).toHaveLength(1);
});

it('queues a review attempt and moves the local schedule (G9)', () => {
  schedule('word:tea', '2026-10-08T00:00:00.000Z', 1);
  expect(
    recordItemReview({
      itemCode: 'word:tea',
      result: 'incorrect',
      durationMs: 2400,
      now: NOW,
    }),
  ).toBe(true);
  const row = getDatabase().execute(
    `SELECT payload_json FROM sync_outbox WHERE event_type = 'activity_attempts';`,
  ).rows!;
  expect(
    ActivityAttemptPayloadSchema.parse(
      JSON.parse(String((row.item(0) as {payload_json: string}).payload_json)),
    ),
  ).toEqual({
    kind: 'review',
    activity: 'item_recall',
    lesson_id: null,
    item_key: 'word:tea',
    session_id: null,
    result: 'incorrect',
    score: null,
    duration_ms: 2400,
  });
  expect(getItemMemory('word:tea')).toMatchObject({
    stage: 0,
    dueAt: '2026-10-10T10:00:00.000Z',
    lastResult: 'incorrect',
  });
});

it('leaves a scheduled item out of the flashcard due list (G10)', () => {
  for (const word of ['coffee', 'latte']) {
    expect(
      saveFlashcard({
        lessonId: 'lesson-1',
        vocabulary: {
          id: `v-${word}`,
          word,
          meaningVi: `nghĩa ${word}`,
          ipa: null,
          wordType: null,
        },
      }).ok,
    ).toBe(true);
  }
  getDatabase().execute(
    "UPDATE review_schedule SET next_review_at = '2026-10-01T00:00:00.000Z';",
  );
  const before = getDueFlashcards({today: NOW.toISOString()});
  expect(before.map(card => card.itemKey).sort()).toEqual([
    'word:coffee',
    'word:latte',
  ]);
  schedule('word:coffee', '2026-10-20T00:00:00.000Z');
  expect(
    getDueFlashcards({today: NOW.toISOString()}).map(card => card.itemKey),
  ).toEqual(['word:latte']);
});
