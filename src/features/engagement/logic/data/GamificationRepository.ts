import {createRequestId} from '@core/api/requestId';
import {getDatabase, withTransaction} from '@core/db/database';
import {enqueueSyncOutboxEvent} from '@core/db/syncOutboxCore';
import type {
  GamificationEventInput,
  GamificationEventRecord,
} from '@core/db/types';

type GamificationEventRow = {
  id: string;
  event_type: string;
  source_event_id: string | null;
  points: number;
  created_at: string;
  revision?: number;
  tombstone?: number;
};

function mapGamificationEventRow(
  row: GamificationEventRow,
): GamificationEventRecord {
  return {
    id: row.id,
    eventType: row.event_type as GamificationEventRecord['eventType'],
    sourceEventId: row.source_event_id ?? '',
    points: row.points,
    createdAt: row.created_at,
    revision: row.revision || 0,
    tombstone: Boolean(row.tombstone),
  };
}

function rowsToRecords(result: {
  rows?: {length: number; item: (index: number) => unknown};
}): GamificationEventRecord[] {
  const rows = result.rows;
  const items: GamificationEventRecord[] = [];
  if (!rows) {
    return items;
  }
  for (let index = 0; index < rows.length; index += 1) {
    items.push(
      mapGamificationEventRow(rows.item(index) as GamificationEventRow),
    );
  }
  return items;
}

/**
 * Appends one row to the gamification event log. Row ids are generated here so
 * callers can treat an event as a pure description of what happened.
 */
export function insertGamificationEvent(
  input: GamificationEventInput,
): GamificationEventRecord {
  const db = getDatabase();
  const id = createRequestId();

  withTransaction(db, () => {
    db.execute(
      `INSERT INTO gamification_events (
        id, event_type, source_event_id, points, created_at
      ) VALUES (?, ?, ?, ?, ?);`,
      [
        id,
        input.eventType,
        input.sourceEventId || null,
        input.points,
        input.createdAt,
      ],
    );

    enqueueSyncOutboxEvent({
      id: createRequestId(),
      eventType: 'gamification_events',
      entityId: id,
      payload: {...input, id},
      createdAt: input.createdAt,
    });
  });

  return {id, revision: 0, tombstone: false, ...input};
}

/** All stored gamification events, oldest first. Used for state derivation. */
export function listGamificationEvents(): GamificationEventRecord[] {
  const db = getDatabase();
  const result = db.execute(
    `SELECT * FROM gamification_events ORDER BY datetime(created_at) ASC, id ASC;`,
  );
  return rowsToRecords(result);
}
