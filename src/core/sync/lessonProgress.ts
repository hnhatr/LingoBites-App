import {createRequestId} from '@core/api/requestId';
import {getDatabase, withTransaction} from '@core/db/database';
import {enqueueSyncOutboxEvent} from '@core/db/syncOutboxCore';
import type {
  LessonProgressEvent,
  LessonProgressStatus,
} from '@core/schemas/sync';

/**
 * Outbox event type for lesson start/complete (LING-149 FR-019/FR-020).
 * Matches the `lesson_progress` sync collection name one-to-one.
 */
export const LESSON_PROGRESS_EVENT_TYPE = 'lesson_progress' as const;

export type RecordLessonEventInput = {
  lessonId: string;
  event: LessonProgressEvent;
  /** Action time. Defaults to now; drives the stored started/completed times. */
  occurredAt?: string;
  /** Client-generated idempotency key. Defaults to a UUIDv4 (INV-002). */
  eventId?: string;
};

export type LessonProgressRecord = {
  lessonId: string;
  status: LessonProgressStatus;
  startedAt: string;
  completedAt: string | null;
  revision: number;
  tombstone: boolean;
  updatedAt: string;
};

export type RecordLessonEventResult =
  | {ok: true; status: LessonProgressStatus; advanced: boolean; eventId: string}
  | {ok: false; errorCode: 'LOCAL_DB_ERROR'};

/** Rank merge for lesson progress (AD-002, INV-001): never moves backward. */
export function lessonProgressRank(status: LessonProgressStatus): number {
  return status === 'completed' ? 2 : 1;
}

export function lessonEventStatus(
  event: LessonProgressEvent,
): LessonProgressStatus {
  return event === 'complete' ? 'completed' : 'in_progress';
}

type LessonProgressRow = {
  lesson_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  revision: number;
  tombstone: number;
  updated_at: string;
};

function mapRowToRecord(row: LessonProgressRow): LessonProgressRecord {
  return {
    lessonId: row.lesson_id,
    status: row.status as LessonProgressStatus,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    revision: row.revision ?? 0,
    tombstone: Boolean(row.tombstone),
    updatedAt: row.updated_at,
  };
}

export type CompletedLessonRow = {
  lessonId: string;
  completedAt: string;
};

/**
 * Completed lessons on device (BR-001, BR-003): `status = completed`, a stored
 * completion time, and not tombstoned.
 */
export function listCompletedLessons(): CompletedLessonRow[] {
  const db = getDatabase();
  const result = db.execute(
    `SELECT lesson_id, completed_at FROM lesson_progress
     WHERE status = 'completed'
       AND completed_at IS NOT NULL
       AND tombstone = 0
     ORDER BY completed_at ASC;`,
  );
  const rows: CompletedLessonRow[] = [];
  if (!result.rows) {
    return rows;
  }
  for (let i = 0; i < result.rows.length; i += 1) {
    const row = result.rows.item(i) as {
      lesson_id: string;
      completed_at: string;
    };
    rows.push({lessonId: row.lesson_id, completedAt: row.completed_at});
  }
  return rows;
}

/**
 * Lessons started but not finished on device, most recently touched first
 * (Home "Học tiếp"). Excludes tombstoned rows.
 */
export function listInProgressLessonIds(): string[] {
  const db = getDatabase();
  const result = db.execute(
    `SELECT lesson_id FROM lesson_progress
     WHERE status = 'in_progress'
       AND tombstone = 0
     ORDER BY updated_at DESC;`,
  );
  const ids: string[] = [];
  if (!result.rows) {
    return ids;
  }
  for (let i = 0; i < result.rows.length; i += 1) {
    ids.push((result.rows.item(i) as {lesson_id: string}).lesson_id);
  }
  return ids;
}

/** Locally stored progress for one lesson, or null when never started. */
export function getLessonProgress(
  lessonId: string,
): LessonProgressRecord | null {
  const db = getDatabase();
  const result = db.execute(
    'SELECT * FROM lesson_progress WHERE lesson_id = ? LIMIT 1;',
    [lessonId],
  );
  const row = result.rows?.item(0) as LessonProgressRow | undefined;
  if (!row) {
    return null;
  }
  return mapRowToRecord(row);
}

/**
 * Records a lesson start/complete tap (LING-149 AC-010 S1, INV-003, INV-010).
 *
 * The local `lesson_progress` merge and the outbox insert run in one
 * `withTransaction`, so a crash between the two statements leaves both or
 * neither: an accepted tap survives kill/restart in the outbox until the
 * server acknowledges it. The merge is monotonic — a `start` arriving after
 * `complete` changes nothing locally (the server would answer `stale`) — but
 * every tap is still queued with its own idempotency key, so the server sees
 * the full event order.
 *
 * The queued mutation always carries the v2 `{event}` payload and is never a
 * tombstone (DEV-002): a tombstoned `lesson_progress` batch is rejected 400
 * `VALIDATION_SYNC`.
 */
export function recordLessonEvent(
  input: RecordLessonEventInput,
): RecordLessonEventResult {
  try {
    const db = getDatabase();
    const occurredAt = input.occurredAt ?? new Date().toISOString();
    const eventId = input.eventId ?? createRequestId();
    const nextStatus = lessonEventStatus(input.event);
    return withTransaction(db, () => {
      const existing = db
        .execute('SELECT * FROM lesson_progress WHERE lesson_id = ? LIMIT 1;', [
          input.lessonId,
        ])
        .rows?.item(0) as LessonProgressRow | undefined;

      let status = nextStatus;
      let startedAt = occurredAt;
      let completedAt: string | null =
        nextStatus === 'completed' ? occurredAt : null;
      let advanced = true;
      if (existing) {
        const currentRank = lessonProgressRank(
          existing.status as LessonProgressStatus,
        );
        const nextRank = lessonProgressRank(nextStatus);
        if (nextRank < currentRank) {
          // No backward transition locally (INV-001); the event is still
          // queued below so the server can answer `stale`.
          status = existing.status as LessonProgressStatus;
          startedAt = existing.started_at;
          completedAt = existing.completed_at;
          advanced = false;
        } else if (nextRank === currentRank) {
          // Same rank: keep the first-applied times, like the server merge.
          status = existing.status as LessonProgressStatus;
          startedAt = existing.started_at;
          completedAt = existing.completed_at;
          advanced = false;
        } else if (nextStatus === 'completed') {
          startedAt = existing.started_at;
          completedAt = occurredAt;
        }
        db.execute(
          `UPDATE lesson_progress
           SET status = ?, started_at = ?, completed_at = ?, updated_at = ?
           WHERE lesson_id = ?;`,
          [status, startedAt, completedAt, occurredAt, input.lessonId],
        );
      } else {
        // A complete from "not started" sets both times (AD-002).
        db.execute(
          `INSERT INTO lesson_progress (
            lesson_id, status, started_at, completed_at, revision,
            tombstone, updated_at
          ) VALUES (?, ?, ?, ?, 0, 0, ?);`,
          [input.lessonId, status, startedAt, completedAt, occurredAt],
        );
      }

      enqueueSyncOutboxEvent({
        id: eventId,
        eventType: LESSON_PROGRESS_EVENT_TYPE,
        entityId: input.lessonId,
        payload: {event: input.event},
        createdAt: occurredAt,
      });
      return {ok: true as const, status, advanced, eventId};
    });
  } catch {
    return {ok: false, errorCode: 'LOCAL_DB_ERROR'};
  }
}
