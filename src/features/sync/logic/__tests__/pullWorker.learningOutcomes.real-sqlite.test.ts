import {readFileSync} from 'fs';
import {join} from 'path';

import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {SyncPullSuccessResponseSchema} from '@core/schemas/sync';
import {
  applyLocalItemReview,
  getItemMemory,
  getLessonOutcome,
  getUnitOutcome,
  listDueItemMemory,
  listPassedLessonIds,
  nextItemMemory,
} from '@core/sync/learningOutcomes';
import {getLessonProgress} from '@core/sync/lessonProgress';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

import {applySyncRecord} from '../pullWorker';

const LESSON = '33333333-3333-4333-8333-333333333303';
const UNIT = '22222222-2222-4222-8222-222222222201';
const ITEM = 'pattern:can-i-have-food';

function fixtureRecords() {
  return SyncPullSuccessResponseSchema.parse(
    JSON.parse(
      readFileSync(
        join(
          __dirname,
          '../../../../core/schemas/__tests__/fixtures/valid-sync-learning-outcomes-pull-response.json',
        ),
        'utf8',
      ),
    ),
  ).records;
}

let db: RealSqliteConnection;

beforeEach(() => {
  db = openRealSqlite();
  resetDatabaseForTests(db);
  runMigrations(db);
});

afterEach(() => {
  db.close();
  resetDatabaseForTests(null);
});

describe('learning outcome pulls (PR 16)', () => {
  it('stores the three collections of the Server fixture', () => {
    for (const record of fixtureRecords()) applySyncRecord(record);

    expect(getLessonOutcome(LESSON)).toEqual({
      lessonId: LESSON,
      practiceCompletedAt: '2026-10-09T03:18:00.000Z',
      passedAt: '2026-10-09T03:20:01.000Z',
      passedBy: 'service',
    });
    expect([...listPassedLessonIds()]).toEqual([LESSON]);
    expect(getUnitOutcome(UNIT)).toEqual({
      unitId: UNIT,
      summativeUnlockedAt: '2026-10-09T03:18:00.000Z',
      passedAt: null,
    });
    expect(getItemMemory(ITEM)).toMatchObject({
      stage: 2,
      lastResult: 'correct',
    });
  });

  it('marks a lesson practised on another device as complete (2.7)', () => {
    expect(getLessonProgress(LESSON)).toBeNull();
    applySyncRecord(fixtureRecords()[0]!);
    expect(getLessonProgress(LESSON)).toMatchObject({
      status: 'completed',
      completedAt: '2026-10-09T03:18:00.000Z',
    });
    const outbox = db.execute('SELECT COUNT(*) AS n FROM sync_outbox;').rows;
    expect(outbox?.item(0)).toEqual({n: 0});
  });

  it('keeps an earlier completion time', () => {
    db.execute(
      `INSERT INTO lesson_progress (lesson_id, status, started_at, completed_at,
         revision, tombstone, updated_at)
       VALUES (?, 'completed', 'a', '2026-10-01T00:00:00.000Z', 0, 0, 'a');`,
      [LESSON],
    );
    applySyncRecord(fixtureRecords()[0]!);
    expect(getLessonProgress(LESSON)?.completedAt).toBe(
      '2026-10-01T00:00:00.000Z',
    );
  });

  it('skips a payload it cannot read and removes a tombstoned row', () => {
    const [lesson, , memory] = fixtureRecords();
    applySyncRecord({...lesson!, payload: {lesson_id: 'nope'}});
    expect(getLessonOutcome(LESSON)).toBeNull();

    applySyncRecord(memory!);
    applySyncRecord({...memory!, payload: {}, tombstone: true});
    expect(getItemMemory(ITEM)).toBeNull();
  });

  it('lists due items, the longest overdue first', () => {
    applySyncRecord(fixtureRecords()[2]!);
    const older = {
      ...fixtureRecords()[2]!,
      entity_id: 'word:latte',
      payload: {
        ...fixtureRecords()[2]!.payload,
        item_code: 'word:latte',
        due_at: '2026-10-15T00:00:00.000Z',
      },
    };
    applySyncRecord(older);
    expect(listDueItemMemory('2026-10-16T00:00:00.000Z')).toHaveLength(1);
    expect(
      listDueItemMemory('2026-10-21T00:00:00.000Z').map(row => row.itemCode),
    ).toEqual(['word:latte', ITEM]);
    expect(listDueItemMemory('2026-10-21T00:00:00.000Z', 1)).toHaveLength(1);
  });
});

describe('local review step (same rule as the Server)', () => {
  const memory = {
    itemCode: ITEM,
    stage: 2,
    dueAt: '2026-10-20T00:00:00.000Z',
    stableAt: null,
    lastResult: null,
    lastReviewedAt: null,
  };

  it('changes nothing before the due time', () => {
    expect(
      nextItemMemory(memory, 'correct', new Date('2026-10-19T00:00:00.000Z')),
    ).toBeNull();
  });

  it('moves one stage up when right and one down when wrong', () => {
    const at = new Date('2026-10-20T00:00:00.000Z');
    expect(nextItemMemory(memory, 'correct', at)).toMatchObject({
      stage: 3,
      dueAt: '2026-11-03T00:00:00.000Z',
      lastResult: 'correct',
    });
    expect(nextItemMemory(memory, 'incorrect', at)).toMatchObject({
      stage: 1,
      dueAt: '2026-10-23T00:00:00.000Z',
    });
    expect(nextItemMemory({...memory, stage: 0}, 'incorrect', at)?.stage).toBe(
      0,
    );
    expect(nextItemMemory({...memory, stage: 4}, 'correct', at)?.stage).toBe(4);
  });

  it('writes the step to the local row', () => {
    applySyncRecord(fixtureRecords()[2]!);
    applyLocalItemReview(ITEM, 'correct', new Date('2026-10-21T00:00:00.000Z'));
    expect(getItemMemory(ITEM)).toMatchObject({
      stage: 3,
      dueAt: '2026-11-04T00:00:00.000Z',
    });
  });
});
