import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {listPendingSyncEvents} from '@features/sync/logic/adapters/SyncOutboxRepository';

import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import type {LessonProgressStatus} from '@core/schemas/sync';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

import {
  getLessonProgress,
  lessonEventStatus,
  lessonProgressRank,
  listCompletedLessons,
  recordLessonEvent,
} from '../lessonProgress';

/**
 * LING-172 (TASK-006): local `lesson_progress` merge + atomic outbox write
 * (AD-002, INV-003, INV-010). Production `recordLessonEvent` runs on a real
 * SQLite engine; failure is injected only at the boundary (SQLite trigger).
 */

const START_ID = '11111111-1111-4111-8111-111111111111';
const COMPLETE_ID = '22222222-2222-4222-8222-222222222222';
const T1 = '2026-10-01T10:00:00.000Z';
const T2 = '2026-10-01T10:05:00.000Z';

let dbFile: string | null = null;
let db: RealSqliteConnection;

function openDb(file = ':memory:'): RealSqliteConnection {
  const connection = openRealSqlite(file);
  resetDatabaseForTests(connection);
  runMigrations(connection);
  return connection;
}

function count(sql: string): number {
  return Number(
    (db.execute(sql).rows?.item(0) as {c: number} | undefined)?.c ?? -1,
  );
}

beforeEach(() => {
  db = openDb();
});

afterEach(() => {
  try {
    db.close();
  } catch {
    // already closed by a restart step
  }
  resetDatabaseForTests(null);
  if (dbFile) {
    fs.rmSync(path.dirname(dbFile), {recursive: true, force: true});
    dbFile = null;
  }
});

describe('lessonProgressRank / lessonEventStatus', () => {
  it('ranks in_progress below completed and maps events to statuses', () => {
    expect(lessonProgressRank('in_progress')).toBeLessThan(
      lessonProgressRank('completed'),
    );
    expect(lessonEventStatus('start')).toBe('in_progress');
    expect(lessonEventStatus('complete')).toBe('completed');
  });
});

describe('recordLessonEvent', () => {
  it('AC-010 S1: start then complete stores completed and queues both events', () => {
    const started = recordLessonEvent({
      lessonId: 'lesson-1',
      event: 'start',
      occurredAt: T1,
      eventId: START_ID,
    });
    expect(started).toEqual({
      ok: true,
      status: 'in_progress',
      advanced: true,
      eventId: START_ID,
    });

    const completed = recordLessonEvent({
      lessonId: 'lesson-1',
      event: 'complete',
      occurredAt: T2,
      eventId: COMPLETE_ID,
    });
    expect(completed).toEqual({
      ok: true,
      status: 'completed',
      advanced: true,
      eventId: COMPLETE_ID,
    });

    expect(getLessonProgress('lesson-1')).toMatchObject({
      lessonId: 'lesson-1',
      status: 'completed',
      startedAt: T1,
      completedAt: T2,
    });

    const pending = listPendingSyncEvents();
    expect(pending.map(e => e.id)).toEqual([START_ID, COMPLETE_ID]);
    expect(pending[0]).toMatchObject({
      eventType: 'lesson_progress',
      entityId: 'lesson-1',
      payload: {event: 'start'},
      createdAt: T1,
    });
    expect(pending[1]).toMatchObject({payload: {event: 'complete'}});
    // DEV-002: queued mutations are never tombstones.
    for (const event of pending) {
      expect((event.payload as {tombstone?: unknown}).tombstone).not.toBe(true);
    }
  });

  it('a complete from not started sets started_at = completed_at (AD-002)', () => {
    const result = recordLessonEvent({
      lessonId: 'lesson-2',
      event: 'complete',
      occurredAt: T1,
      eventId: COMPLETE_ID,
    });
    expect(result).toMatchObject({ok: true, status: 'completed'});
    expect(getLessonProgress('lesson-2')).toMatchObject({
      status: 'completed',
      startedAt: T1,
      completedAt: T1,
    });
  });

  it('a start arriving after completion never regresses locally (INV-001)', () => {
    recordLessonEvent({
      lessonId: 'lesson-3',
      event: 'complete',
      occurredAt: T1,
      eventId: COMPLETE_ID,
    });
    const late = recordLessonEvent({
      lessonId: 'lesson-3',
      event: 'start',
      occurredAt: T2,
      eventId: START_ID,
    });
    expect(late).toMatchObject({
      ok: true,
      status: 'completed',
      advanced: false,
    });
    expect(getLessonProgress('lesson-3')).toMatchObject({
      status: 'completed',
      startedAt: T1,
      completedAt: T1,
    });
    // Both taps stay queued; the late start is answered `stale` on the server.
    expect(listPendingSyncEvents()).toHaveLength(2);
  });

  it('a repeated event keeps the first-applied times', () => {
    recordLessonEvent({
      lessonId: 'lesson-4',
      event: 'start',
      occurredAt: T1,
      eventId: START_ID,
    });
    const repeat = recordLessonEvent({
      lessonId: 'lesson-4',
      event: 'start',
      occurredAt: T2,
      eventId: COMPLETE_ID,
    });
    expect(repeat).toMatchObject({
      ok: true,
      status: 'in_progress',
      advanced: false,
    });
    expect(getLessonProgress('lesson-4')).toMatchObject({
      status: 'in_progress',
      startedAt: T1,
      completedAt: null,
    });
  });

  it('returns null progress for a lesson never started', () => {
    expect(getLessonProgress('missing')).toBeNull();
  });

  it('INV-003/INV-010: a crash between the state and outbox writes leaves both or neither', () => {
    db.raw.exec(`CREATE TRIGGER ling172_fail_outbox BEFORE INSERT ON sync_outbox
      BEGIN SELECT RAISE(ABORT, 'LING-172 injected outbox failure'); END;`);

    expect(
      recordLessonEvent({
        lessonId: 'lesson-5',
        event: 'start',
        occurredAt: T1,
        eventId: START_ID,
      }),
    ).toEqual({ok: false, errorCode: 'LOCAL_DB_ERROR'});

    expect(getLessonProgress('lesson-5')).toBeNull();
    expect(count('SELECT COUNT(*) AS c FROM sync_outbox')).toBe(0);
    expect(count('SELECT COUNT(*) AS c FROM lesson_progress')).toBe(0);
  });

  it('AC-010 S7: an accepted tap survives kill/restart in the outbox', () => {
    dbFile = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'ling172-progress-')),
      'lingobites.sqlite',
    );
    db.close();
    db = openDb(dbFile);

    recordLessonEvent({
      lessonId: 'lesson-6',
      event: 'start',
      occurredAt: T1,
      eventId: START_ID,
    });

    // Process kill + cold start: reopen the same SQLite file.
    db.close();
    db = openDb(dbFile);

    expect(getLessonProgress('lesson-6')).toMatchObject({
      status: 'in_progress',
      startedAt: T1,
    });
    expect(listPendingSyncEvents().map(e => e.id)).toEqual([START_ID]);
  });

  it('TC-1B: listCompletedLessons returns completed rows with times, excluding tombstones', () => {
    recordLessonEvent({
      lessonId: 'lesson-done-a',
      event: 'complete',
      occurredAt: T1,
      eventId: START_ID,
    });
    recordLessonEvent({
      lessonId: 'lesson-done-b',
      event: 'complete',
      occurredAt: T2,
      eventId: COMPLETE_ID,
    });
    recordLessonEvent({
      lessonId: 'lesson-started-only',
      event: 'start',
      occurredAt: T1,
    });
    db.execute(
      `INSERT INTO lesson_progress (
        lesson_id, status, started_at, completed_at, revision, tombstone, updated_at
      ) VALUES (?, 'completed', ?, ?, 1, 1, ?);`,
      ['lesson-tombstoned', T1, T1, T1],
    );
    db.execute(
      `INSERT INTO lesson_progress (
        lesson_id, status, started_at, completed_at, revision, tombstone, updated_at
      ) VALUES (?, 'completed', ?, NULL, 1, 0, ?);`,
      ['lesson-null-time', T1, T1],
    );

    expect(listCompletedLessons()).toEqual([
      {lessonId: 'lesson-done-a', completedAt: T1},
      {lessonId: 'lesson-done-b', completedAt: T2},
    ]);
  });

  it('keeps one row per lesson across statuses', () => {
    const statuses: LessonProgressStatus[] = ['in_progress', 'completed'];
    expect(statuses.map(lessonProgressRank)).toEqual([1, 2]);
    recordLessonEvent({lessonId: 'lesson-7', event: 'start', occurredAt: T1});
    recordLessonEvent({
      lessonId: 'lesson-7',
      event: 'complete',
      occurredAt: T2,
    });
    expect(count('SELECT COUNT(*) AS c FROM lesson_progress')).toBe(1);
  });
});
