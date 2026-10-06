import {pushReviewEvents, type SyncReviewEvent} from '@features/review';

import type {ReviewEventPayload, SyncOutboxRecord} from '@core/db/types';
import {REVIEW_EVENT_TYPE} from '@core/db/types';
import {
  LessonProgressPushPayloadSchema,
  SyncCollectionSchema,
  type SyncPushMutation,
} from '@core/schemas/sync';
import {LESSON_PROGRESS_EVENT_TYPE} from '@core/sync/lessonProgress';
import {
  beginSyncDrainOwnership,
  endSyncDrainOwnership,
  SYNC_OWNERSHIP_CHANGED,
} from '@core/sync/syncDrainOwnership';

import {
  countPendingSyncEvents,
  listPendingSyncEvents,
  markSyncEventsFailed,
  markSyncEventsSynced,
} from './adapters/SyncOutboxRepository';
import {syncPush} from './syncClient';
import {isSyncStuck, MAX_SYNC_ATTEMPTS, SYNC_BATCH_LIMIT} from './syncPolicy';

export type SyncDrainOutcome =
  | {status: 'idle'}
  | {status: 'stuck'}
  | {status: 'synced'; syncedIds: string[]}
  | {
      status: 'failed';
      errorCode: string;
      message: string;
      retryable: boolean;
    };

type DrainDeps = {
  fetchImpl?: typeof fetch;
  /**
   * When true, rows that already reached the attempt cap are retried anyway.
   * Used by explicit, human/event-paced triggers (a rating write, an app
   * foreground) so a reconnect can still drain a "stuck" queue — the cap only
   * stops the automatic backoff timer from retrying forever.
   */
  includeStuck?: boolean;
};

function isGenericSyncCollection(eventType: string): boolean {
  return SyncCollectionSchema.safeParse(eventType).success;
}

function toReviewWireEvent(event: SyncOutboxRecord): SyncReviewEvent {
  return {
    id: event.id,
    event_type: REVIEW_EVENT_TYPE,
    entity_id: event.entityId,
    payload: event.payload as ReviewEventPayload,
    created_at: event.createdAt,
  };
}

/**
 * Sends one batch of pending outbox rows to the server and reconciles local
 * state: rows acknowledged by the server (accepted or reported as duplicates)
 * are marked `synced_at`; failures increment `attempt_count` and record the
 * error so a later drain retries them with backoff.
 *
 * The queue is mixed — review rows go to `/v1/review-events`, every other
 * known collection goes through `/v1/sync/push`. Rows of an unknown type are
 * failed permanently (the attempt cap stops the backoff storm).
 */
export async function drainOutboxOnce(
  deps: DrainDeps = {},
): Promise<SyncDrainOutcome> {
  beginSyncDrainOwnership();
  try {
    return await drainOutboxOnceInner(deps);
  } finally {
    endSyncDrainOwnership();
  }
}

async function drainOutboxOnceInner(
  deps: DrainDeps = {},
): Promise<SyncDrainOutcome> {
  const maxAttempts = deps.includeStuck ? undefined : MAX_SYNC_ATTEMPTS;
  const events = listPendingSyncEvents({
    limit: SYNC_BATCH_LIMIT,
    maxAttempts,
  });
  if (events.length === 0) {
    const totalPending = countPendingSyncEvents();
    if (totalPending > 0 && !deps.includeStuck) {
      return {status: 'stuck'};
    }
    return {status: 'idle'};
  }

  const eligible = events;

  const reviewEvents = eligible.filter(
    event => event.eventType === REVIEW_EVENT_TYPE,
  );
  const genericEvents = eligible.filter(event =>
    isGenericSyncCollection(event.eventType),
  );
  const unknownEvents = eligible.filter(
    event =>
      event.eventType !== REVIEW_EVENT_TYPE &&
      !isGenericSyncCollection(event.eventType),
  );
  const reviewBatch = reviewEvents;

  const syncedIds: string[] = [];
  let firstRetryableFailure: {errorCode: string; message: string} | undefined;
  let firstPermanentFailure: {errorCode: string; message: string} | undefined;

  if (unknownEvents.length > 0) {
    const unknownIds = unknownEvents.map(e => e.id);
    markSyncEventsFailed(unknownIds, 'UNKNOWN_EVENT_TYPE');
    firstPermanentFailure ??= {
      errorCode: 'UNKNOWN_EVENT_TYPE',
      message: `Unknown event type: ${unknownEvents[0].eventType}`,
    };
  }

  if (reviewBatch.length > 0) {
    const result = await pushReviewEvents(
      reviewBatch.map(toReviewWireEvent),
      deps,
    );
    if (result.ok) {
      const ids = [...result.acceptedIds, ...result.duplicateIds];
      markSyncEventsSynced(ids);
      syncedIds.push(...ids);
    } else {
      if (result.errorCode !== SYNC_OWNERSHIP_CHANGED) {
        markSyncEventsFailed(
          reviewBatch.map(event => event.id),
          result.message,
        );
      }
      const failure = {errorCode: result.errorCode, message: result.message};
      if (result.retryable) {
        firstRetryableFailure ??= failure;
      } else {
        firstPermanentFailure ??= failure;
      }
    }
  }

  // LING-149 (INV-003): `lesson_progress` travels in its own push batch so a
  // batch-level 400 caused by another collection (e.g. an invalid flashcard
  // mutation) can never block progress. The server never rejects a
  // well-formed `lesson_progress` mutation (clamp, no lesson lookup).
  const lessonProgressEvents = genericEvents.filter(
    event => event.eventType === LESSON_PROGRESS_EVENT_TYPE,
  );
  const otherGenericEvents = genericEvents.filter(
    event => event.eventType !== LESSON_PROGRESS_EVENT_TYPE,
  );

  // DEV-002: a `lesson_progress` mutation must carry the v2 `{event}` payload
  // and must never be a tombstone — the server rejects such a batch with 400
  // `VALIDATION_SYNC`. These rows are failed permanently here instead of
  // being sent: they can never succeed by retrying.
  const wellFormedProgressEvents: SyncOutboxRecord[] = [];
  for (const event of lessonProgressEvents) {
    const payload = event.payload as Record<string, unknown>;
    if (
      payload?.tombstone === true ||
      !LessonProgressPushPayloadSchema.safeParse(payload).success
    ) {
      markSyncEventsFailed([event.id], 'INVALID_LESSON_PROGRESS_PAYLOAD');
      firstPermanentFailure ??= {
        errorCode: 'INVALID_LESSON_PROGRESS_PAYLOAD',
        message: 'Invalid lesson_progress payload',
      };
    } else {
      wellFormedProgressEvents.push(event);
    }
  }

  if (wellFormedProgressEvents.length > 0) {
    const mutations: SyncPushMutation[] = wellFormedProgressEvents.map(
      event => ({
        mutation_id: event.id,
        collection: LESSON_PROGRESS_EVENT_TYPE,
        entity_id: event.entityId,
        payload: event.payload as Record<string, unknown>,
        tombstone: false,
        occurred_at: event.createdAt,
      }),
    );

    const result = await syncPush({mutations}, deps);
    if (result.ok) {
      // Every returned id — `applied`, `duplicate` or `stale` — is
      // acknowledged by the server and leaves the outbox.
      const successfulIds = result.data.results.map(r => r.mutation_id);
      if (successfulIds.length > 0) {
        markSyncEventsSynced(successfulIds);
        syncedIds.push(...successfulIds);
      }
    } else {
      if (result.errorCode !== SYNC_OWNERSHIP_CHANGED) {
        markSyncEventsFailed(
          wellFormedProgressEvents.map(event => event.id),
          result.message,
        );
      }
      const failure = {errorCode: result.errorCode, message: result.message};
      if (result.retryable) {
        firstRetryableFailure ??= failure;
      } else {
        firstPermanentFailure ??= failure;
      }
    }
  }

  if (otherGenericEvents.length > 0) {
    const mutations: SyncPushMutation[] = otherGenericEvents.map(event => ({
      mutation_id: event.id,
      collection: event.eventType as any, // We know it's valid
      entity_id: event.entityId,
      payload: (event.payload as any).tombstone ? {} : event.payload,
      tombstone: (event.payload as any).tombstone === true,
      occurred_at: event.createdAt,
    }));

    const result = await syncPush({mutations}, deps);
    if (result.ok) {
      const successfulIds = result.data.results.map(r => r.mutation_id);
      if (successfulIds.length > 0) {
        markSyncEventsSynced(successfulIds);
        syncedIds.push(...successfulIds);
      }

      // If a result was marked 'stale', it means our write lost, but we still consider it successfully processed by the outbox
      // (Actually, successfulIds includes 'applied', 'duplicate', 'stale')

      // For any failures not in results (though syncPush returns all), we could handle them.
      // But syncPush either succeeds the whole batch (and returns results for each) or fails the whole batch.
    } else {
      if (result.errorCode !== SYNC_OWNERSHIP_CHANGED) {
        markSyncEventsFailed(
          otherGenericEvents.map(event => event.id),
          result.message,
        );
      }
      const failure = {errorCode: result.errorCode, message: result.message};
      if (result.retryable) {
        firstRetryableFailure ??= failure;
      } else {
        firstPermanentFailure ??= failure;
      }
    }
  }

  if (syncedIds.length > 0) {
    return {status: 'synced', syncedIds};
  }
  if (firstRetryableFailure) {
    return {
      status: 'failed',
      errorCode: firstRetryableFailure.errorCode,
      message: firstRetryableFailure.message,
      retryable: true,
    };
  }
  if (firstPermanentFailure) {
    return {
      status: 'failed',
      errorCode: firstPermanentFailure.errorCode,
      message: firstPermanentFailure.message,
      retryable: false,
    };
  }
  // No rows synced and no failures recorded (e.g. only malformed rows that
  // were already handled) — report progress-less drain as stuck-safe idle.
  return {status: 'idle'};
}

export type SyncOutboxStatus = {
  pending: number;
  stuck: number;
};

/**
 * Current outbox health. `stuck` counts rows that hit the attempt cap and are
 * no longer auto-retried; a UI/settings surface can use this to show a
 * "sync stuck" state.
 */
export function getSyncOutboxStatus(): SyncOutboxStatus {
  const pending = countPendingSyncEvents();
  const stuck = listPendingSyncEvents().filter(event =>
    isSyncStuck(event.attemptCount),
  ).length;
  return {pending, stuck};
}
