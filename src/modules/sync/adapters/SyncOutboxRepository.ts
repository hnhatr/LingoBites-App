import {getDatabase} from '@shared/db/database';
import type {
  SyncOutboxPayload,
  SyncOutboxRecord,
  SyncOutboxRow,
} from '@shared/db/types';

type PendingOptions = {
  limit?: number;
  maxAttempts?: number;
};

function mapRow(row: SyncOutboxRow): SyncOutboxRecord {
  return {
    id: row.id,
    eventType: row.event_type,
    entityId: row.entity_id,
    payload: JSON.parse(row.payload_json) as SyncOutboxPayload,
    createdAt: row.created_at,
    attemptCount: row.attempt_count,
    lastError: row.last_error,
    syncedAt: row.synced_at,
  };
}

function firstRow<T>(result: {
  rows?: {item: (index: number) => unknown};
}): T | null {
  return (result.rows?.item(0) as T | undefined) ?? null;
}

/** Returns pending (unsynced) rows, oldest first, capped at `limit`. */
export function listPendingSyncEvents({
  limit,
  maxAttempts,
}: PendingOptions = {}): SyncOutboxRecord[] {
  const db = getDatabase();
  const whereClauses = ['synced_at IS NULL'];
  const params: Array<string | number> = [];

  if (typeof maxAttempts === 'number') {
    whereClauses.push('attempt_count < ?');
    params.push(maxAttempts);
  }

  const limitClause = limit && limit > 0 ? ' LIMIT ?' : '';
  if (limit && limit > 0) {
    params.push(limit);
  }

  const result = db.execute(
    `SELECT id, event_type, entity_id, payload_json, created_at,
            attempt_count, last_error, synced_at
     FROM sync_outbox
     WHERE ${whereClauses.join(' AND ')}
     ORDER BY datetime(created_at) ASC${limitClause};`,
    params,
  );
  const rows = result.rows;
  const items: SyncOutboxRecord[] = [];
  if (!rows) {
    return items;
  }
  for (let index = 0; index < rows.length; index += 1) {
    items.push(mapRow(rows.item(index) as SyncOutboxRow));
  }
  return items;
}

export function countPendingSyncEvents(): number {
  const db = getDatabase();
  const row = firstRow<{count: number}>(
    db.execute(
      'SELECT COUNT(*) AS count FROM sync_outbox WHERE synced_at IS NULL;',
    ),
  );
  return row?.count ?? 0;
}

/** Marks the given ids as drained/synced; leaves already-synced rows untouched. */
export function markSyncEventsSynced(
  ids: string[],
  syncedAt = new Date().toISOString(),
): number {
  const db = getDatabase();
  let affected = 0;
  for (const id of ids) {
    const result = db.execute(
      `UPDATE sync_outbox
        SET synced_at = ?, last_error = NULL
        WHERE id = ? AND synced_at IS NULL;`,
      [syncedAt, id],
    );
    affected += result.rowsAffected ?? 0;
  }
  return affected;
}

/**
 * Records a failed drain attempt: increments `attempt_count` and stores the
 * last error. Exponential backoff and the attempt cap are policy decisions
 * layered on `attempt_count` by the sync worker, not the repository.
 */
export function markSyncEventsFailed(
  ids: string[],
  errorMessage: string,
): number {
  const db = getDatabase();
  let affected = 0;
  for (const id of ids) {
    const result = db.execute(
      `UPDATE sync_outbox
        SET attempt_count = attempt_count + 1, last_error = ?
        WHERE id = ? AND synced_at IS NULL;`,
      [errorMessage, id],
    );
    affected += result.rowsAffected ?? 0;
  }
  return affected;
}

/** Removes rows (used by tests and, later, any "reset stuck sync" affordance). */
export function deleteSyncEvents(ids: string[]): number {
  const db = getDatabase();
  let affected = 0;
  for (const id of ids) {
    const result = db.execute('DELETE FROM sync_outbox WHERE id = ?;', [id]);
    affected += result.rowsAffected ?? 0;
  }
  return affected;
}
