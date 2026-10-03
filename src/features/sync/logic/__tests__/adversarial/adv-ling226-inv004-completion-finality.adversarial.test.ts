import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import type {SyncPullRecord} from '@core/schemas/sync';
import {
  getLessonProgress,
  listCompletedLessons,
  recordLessonEvent,
} from '@core/sync/lessonProgress';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

import {
  applySyncRecord,
  startPullWorker,
  stopPullWorker,
} from '../../pullWorker';

const LOCAL_TIME = '2026-10-06T10:00:00.000Z';
const EARLIER_TIME = '2026-09-29T10:00:00.000Z';
const LATER_TIME = '2026-10-07T12:00:00.000Z';
const COMPLETE_EVENT_ID = '55555555-5555-4555-8555-555555555555';

let db: RealSqliteConnection;
let previousFetch: typeof global.fetch;

function completedRecord(
  lessonId: string,
  completedAt: string,
  revision: number,
): SyncPullRecord {
  return {
    collection: 'lesson_progress',
    entity_id: lessonId,
    payload: {
      status: 'completed',
      started_at: completedAt,
      completed_at: completedAt,
    },
    revision,
    occurred_at: completedAt,
    updated_at: completedAt,
    tombstone: false,
  };
}

function inProgressRecord(
  lessonId: string,
  occurredAt: string,
  revision: number,
): SyncPullRecord {
  return {
    collection: 'lesson_progress',
    entity_id: lessonId,
    payload: {
      status: 'in_progress',
      started_at: occurredAt,
      completed_at: null,
    },
    revision,
    occurred_at: occurredAt,
    updated_at: occurredAt,
    tombstone: false,
  };
}

function pullResponse(
  records: SyncPullRecord[],
  nextCursor: string,
  hasMore: boolean,
): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      request_id: '66666666-6666-4666-8666-666666666666',
      status: 'success',
      contract_version: 2,
      records,
      next_cursor: nextCursor,
      has_more: hasMore,
    }),
  } as Response;
}

async function waitUntil(
  condition: () => boolean,
  failureMessage: string,
): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (condition()) {
      return;
    }
    await new Promise(resolve => setImmediate(resolve));
  }
  throw new Error(failureMessage);
}

function cursor(): string | null {
  const row = db
    .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [
      'sync_cursor',
    ])
    .rows?.item(0) as {value?: string} | undefined;
  return row?.value ?? null;
}

beforeEach(() => {
  db = openRealSqlite();
  resetDatabaseForTests(db);
  runMigrations(db);
  previousFetch = global.fetch;
  stopPullWorker();
});

afterEach(() => {
  stopPullWorker();
  global.fetch = previousFetch;
  jest.restoreAllMocks();
  db.close();
  resetDatabaseForTests(null);
});

describe('LING-226 / INV-004 completion finality on real SQLite', () => {
  it('HELD: every rank, timestamp, and tombstone pull leaves a completed row byte-for-byte final', () => {
    recordLessonEvent({
      lessonId: 'lesson-final',
      event: 'complete',
      occurredAt: LOCAL_TIME,
      eventId: COMPLETE_EVENT_ID,
    });
    const before = getLessonProgress('lesson-final');

    const attacks: SyncPullRecord[] = [
      completedRecord('lesson-final', EARLIER_TIME, 99),
      completedRecord('lesson-final', LATER_TIME, 100),
      inProgressRecord('lesson-final', LATER_TIME, 101),
      {
        ...completedRecord('lesson-final', LATER_TIME, 102),
        tombstone: true,
      },
    ];

    for (const attack of attacks) {
      applySyncRecord(attack);
      expect(getLessonProgress('lesson-final')).toEqual(before);
      expect(listCompletedLessons()).toEqual([
        {lessonId: 'lesson-final', completedAt: LOCAL_TIME},
      ]);
    }
  });

  it('HELD: either serialization of a local completion and remote completion keeps the first stored time', () => {
    applySyncRecord(completedRecord('pull-first', EARLIER_TIME, 1));
    applySyncRecord(completedRecord('pull-first', LATER_TIME, 2));
    recordLessonEvent({
      lessonId: 'pull-first',
      event: 'complete',
      occurredAt: LOCAL_TIME,
    });

    recordLessonEvent({
      lessonId: 'local-first',
      event: 'complete',
      occurredAt: LOCAL_TIME,
    });
    applySyncRecord(completedRecord('local-first', EARLIER_TIME, 99));

    expect(getLessonProgress('pull-first')).toMatchObject({
      status: 'completed',
      completedAt: EARLIER_TIME,
    });
    expect(getLessonProgress('local-first')).toMatchObject({
      status: 'completed',
      completedAt: LOCAL_TIME,
    });
  });

  it('HELD: a completion committed while pull is in flight survives duplicate and out-of-order pages', async () => {
    let resolveFirstPull!: (response: Response) => void;
    const firstPull = new Promise<Response>(resolve => {
      resolveFirstPull = resolve;
    });
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() => firstPull)
      .mockResolvedValueOnce(
        pullResponse(
          [
            inProgressRecord('lesson-race', LATER_TIME, 100),
            completedRecord('lesson-race', LATER_TIME, 101),
            {
              ...completedRecord('lesson-race', LATER_TIME, 102),
              tombstone: true,
            },
          ],
          'cursor-2',
          false,
        ),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    startPullWorker();
    startPullWorker();
    await waitUntil(
      () => fetchMock.mock.calls.length === 1,
      'pull worker did not start its first page',
    );

    recordLessonEvent({
      lessonId: 'lesson-race',
      event: 'complete',
      occurredAt: LOCAL_TIME,
      eventId: COMPLETE_EVENT_ID,
    });
    resolveFirstPull(
      pullResponse(
        [completedRecord('lesson-race', EARLIER_TIME, 99)],
        'cursor-1',
        true,
      ),
    );

    await waitUntil(
      () => cursor() === 'cursor-2',
      'pull worker did not consume both pages',
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getLessonProgress('lesson-race')).toMatchObject({
      status: 'completed',
      completedAt: LOCAL_TIME,
      revision: 0,
      tombstone: false,
    });
    expect(listCompletedLessons()).toEqual([
      {lessonId: 'lesson-race', completedAt: LOCAL_TIME},
    ]);
  });

  it('HELD: a later malformed record rolls back the page and cannot disturb a completed row', async () => {
    recordLessonEvent({
      lessonId: 'lesson-rollback',
      event: 'complete',
      occurredAt: LOCAL_TIME,
      eventId: COMPLETE_EVENT_ID,
    });
    const before = getLessonProgress('lesson-rollback');
    const timeoutSpy = jest.spyOn(global, 'setTimeout');
    const malformedRecord = {
      ...inProgressRecord('malformed', LATER_TIME, 100),
      payload: {status: 'bogus'},
    } as unknown as SyncPullRecord;
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        pullResponse(
          [
            completedRecord('lesson-rollback', EARLIER_TIME, 99),
            malformedRecord,
          ],
          'must-not-commit',
          false,
        ),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    startPullWorker();
    await waitUntil(
      () => timeoutSpy.mock.calls.some((call: unknown[]) => call[1] === 5000),
      'pull worker did not schedule its rollback retry',
    );
    stopPullWorker();

    expect(cursor()).toBeNull();
    expect(getLessonProgress('lesson-rollback')).toEqual(before);
    expect(listCompletedLessons()).toEqual([
      {lessonId: 'lesson-rollback', completedAt: LOCAL_TIME},
    ]);
  });
});
