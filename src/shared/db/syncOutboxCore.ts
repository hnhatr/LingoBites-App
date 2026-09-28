import {REVIEW_EVENT_TYPE} from './types';
import {getDatabase} from './database';
import type {SyncOutboxEventType, SyncOutboxPayload} from './types';

export type EnqueueSyncOutboxEventInput = {
  /** Client-generated id — doubles as the server-side idempotency key. */
  id: string;
  entityId: string;
  payload: SyncOutboxPayload;
  createdAt?: string;
  /**
   * Outbox event type. Defaults to `review` so existing review call sites
   * keep working unchanged (P12 preserves review behaviour).
   */
  eventType?: SyncOutboxEventType;
};

/**
 * Appends a pending outbox event. Intended to be called inside the same
 * transaction that commits the underlying review/practice write (ADR-2),
 * so a crash cannot produce a local session with no outbox entry.
 * Safe to call inside an outer `withTransaction` — it performs a single
 * INSERT with no BEGIN/COMMIT of its own.
 */
export function enqueueSyncOutboxEvent(
  input: EnqueueSyncOutboxEventInput,
): void {
  const db = getDatabase();
  const createdAt = input.createdAt ?? new Date().toISOString();
  db.execute(
    `INSERT INTO sync_outbox (
      id, event_type, entity_id, payload_json, created_at, attempt_count,
      last_error, synced_at
    ) VALUES (?, ?, ?, ?, ?, 0, NULL, NULL);`,
    [
      input.id,
      input.eventType ?? REVIEW_EVENT_TYPE,
      input.entityId,
      JSON.stringify(input.payload),
      createdAt,
    ],
  );
}
