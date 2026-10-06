import {createRequestId} from '@core/api/requestId';
import {getDatabase, withTransaction} from '@core/db/database';
import {enqueueSyncOutboxEvent} from '@core/db/syncOutboxCore';
import {
  type ActivityAttemptPayload,
  ActivityAttemptPayloadSchema,
} from '@core/schemas/sync';

/** Outbox event type and sync collection name (schema v5). */
export const ACTIVITY_ATTEMPTS_EVENT_TYPE = 'activity_attempts' as const;

export type RecordActivityAttemptInput = {
  kind: ActivityAttemptPayload['kind'];
  /** The generator or game that produced the round, e.g. `meaning_choice`. */
  activity: string;
  lessonId?: string | null;
  /** Cross-lesson identity of the item, e.g. `word:coffee`. */
  itemKey?: string | null;
  sessionId?: string | null;
  result: ActivityAttemptPayload['result'];
  score?: number | null;
  durationMs: number;
  occurredAt?: string;
  /** Client-generated attempt id; defaults to a new uuid. */
  id?: string;
};

export type RecordActivityAttemptResult =
  | {ok: true; id: string}
  | {ok: false; errorCode: 'INVALID_ATTEMPT' | 'LOCAL_DB_ERROR'};

/**
 * Appends one attempt (a review card, a practice question or a game round) and
 * queues it for sync in the same transaction, so a crash can never leave a row
 * with no outbox entry. The payload is validated against the Server contract
 * first: an attempt the Server would reject is refused here instead of
 * poisoning the outbox.
 */
export function recordActivityAttempt(
  input: RecordActivityAttemptInput,
): RecordActivityAttemptResult {
  const payload = ActivityAttemptPayloadSchema.safeParse({
    kind: input.kind,
    activity: input.activity,
    lesson_id: input.lessonId ?? null,
    item_key: input.itemKey ?? null,
    session_id: input.sessionId ?? null,
    result: input.result,
    score: input.score ?? null,
    duration_ms: Math.round(input.durationMs),
  });
  if (!payload.success) {
    return {ok: false, errorCode: 'INVALID_ATTEMPT'};
  }

  const id = input.id ?? createRequestId();
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const data = payload.data;
  try {
    const db = getDatabase();
    withTransaction(db, () => {
      db.execute(
        `INSERT INTO activity_attempts (
          id, kind, activity, lesson_id, item_key, session_id, result, score,
          duration_ms, occurred_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          id,
          data.kind,
          data.activity,
          data.lesson_id,
          data.item_key,
          data.session_id,
          data.result,
          data.score,
          data.duration_ms,
          occurredAt,
          occurredAt,
        ],
      );
      enqueueSyncOutboxEvent({
        id: createRequestId(),
        eventType: ACTIVITY_ATTEMPTS_EVENT_TYPE,
        entityId: id,
        payload: data,
        createdAt: occurredAt,
      });
    });
    return {ok: true, id};
  } catch {
    return {ok: false, errorCode: 'LOCAL_DB_ERROR'};
  }
}

export type ActivityAttemptRow = {
  id: string;
  kind: ActivityAttemptPayload['kind'];
  activity: string;
  lessonId: string | null;
  itemKey: string | null;
  sessionId: string | null;
  result: ActivityAttemptPayload['result'];
  score: number | null;
  durationMs: number;
  occurredAt: string;
};

/** Live attempts of one lesson, newest first. */
export function listActivityAttempts(lessonId: string): ActivityAttemptRow[] {
  const db = getDatabase();
  const result = db.execute(
    `SELECT * FROM activity_attempts
      WHERE lesson_id = ? AND tombstone = 0
      ORDER BY occurred_at DESC;`,
    [lessonId],
  );
  const rows: ActivityAttemptRow[] = [];
  for (let index = 0; index < (result.rows?.length ?? 0); index += 1) {
    const row = result.rows!.item(index) as Record<string, unknown>;
    rows.push({
      id: row.id as string,
      kind: row.kind as ActivityAttemptRow['kind'],
      activity: row.activity as string,
      lessonId: (row.lesson_id as string | null) ?? null,
      itemKey: (row.item_key as string | null) ?? null,
      sessionId: (row.session_id as string | null) ?? null,
      result: row.result as ActivityAttemptRow['result'],
      score: (row.score as number | null) ?? null,
      durationMs: row.duration_ms as number,
      occurredAt: row.occurred_at as string,
    });
  }
  return rows;
}
