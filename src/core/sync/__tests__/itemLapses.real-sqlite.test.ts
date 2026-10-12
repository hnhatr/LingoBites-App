import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {applyLocalItemReview, lapsesOf} from '@core/sync/learningOutcomes';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

/** Vocab path P5: wrong answers are counted on the device, and a pull or a review never resets the count. */

const NOW = new Date('2026-10-12T08:00:00.000Z');

function schedule(code: string, stage = 1) {
  getDatabase().execute(
    `INSERT INTO item_memory (item_code, stage, due_at, updated_at, lapses)
     VALUES (?, ?, ?, ?, 0);`,
    [code, stage, NOW.toISOString(), NOW.toISOString()],
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

it('counts only the wrong answers', () => {
  schedule('word:coffee');
  applyLocalItemReview('word:coffee', 'incorrect', NOW);
  applyLocalItemReview('word:coffee', 'correct', NOW);
  applyLocalItemReview('word:coffee', 'incorrect', NOW);
  expect(lapsesOf('word:coffee')).toBe(2);
});

it('keeps the count when a pull rewrites the schedule', () => {
  schedule('word:tea');
  applyLocalItemReview('word:tea', 'incorrect', NOW);
  applyLocalItemReview('word:tea', 'incorrect', NOW);
  // The same upsert a pull uses: the schedule changes, the count does not.
  getDatabase().execute(
    `INSERT INTO item_memory (item_code, stage, due_at, updated_at)
     VALUES ('word:tea', 5, ?, ?)
     ON CONFLICT (item_code) DO UPDATE SET stage = excluded.stage,
       due_at = excluded.due_at, updated_at = excluded.updated_at;`,
    [NOW.toISOString(), NOW.toISOString()],
  );
  expect(lapsesOf('word:tea')).toBe(2);
});

it('is zero for an item the learner has not scheduled', () => {
  expect(lapsesOf('word:never')).toBe(0);
});
