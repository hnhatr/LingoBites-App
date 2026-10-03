import {AppState, type AppStateStatus} from 'react-native';

import {getDatabase, withTransaction} from '@core/db/database';
import {
  LessonProgressStatePayloadSchema,
  SyncCollectionSchema,
  type SyncPullRecord,
  type SyncRecord,
} from '@core/schemas/sync';
import {
  LESSON_PROGRESS_EVENT_TYPE,
  lessonProgressRank,
} from '@core/sync/lessonProgress';
import {
  applySpeakingAttemptRecord,
  SPEAKING_ATTEMPTS_EVENT_TYPE,
} from '@core/sync/speakingAttempts';

import {syncPull} from './syncClient';

let isRunning = false;
let isEnabled = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let subscription: {remove: () => void} | null = null;

function getCursor(): string {
  const db = getDatabase();
  const res = db.execute(
    'SELECT value FROM app_settings WHERE key = ? LIMIT 1;',
    ['sync_cursor'],
  );
  if (res.rows && res.rows.length > 0) {
    return res.rows.item(0).value as string;
  }
  return '';
}

function saveCursor(cursor: string) {
  const db = getDatabase();
  db.execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    ['sync_cursor', cursor, new Date().toISOString()],
  );
}

function mapToSnakeCase(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  const res: any = {};
  for (const key of Object.keys(obj)) {
    const snakeKey = key.replace(
      /[A-Z]/g,
      letter => `_${letter.toLowerCase()}`,
    );
    res[snakeKey] = obj[key];
  }
  return res;
}

function getTableForCollection(collection: string): string {
  if (collection === 'review_schedules') return 'review_schedule';
  if (
    collection === 'content_review_state' ||
    collection === 'content_lesson_state'
  ) {
    return 'content_lesson_state';
  }
  return collection;
}

/**
 * Applies one `lesson_progress` pull record with the AD-002 rank merge
 * (INV-001, App half): the local state is replaced only when the remote rank
 * is greater than or equal to the local rank, so a pull never overwrites a
 * higher local rank. This path deliberately bypasses the generic
 * revision/`tombstone` handling — progress rows are never tombstoned and
 * completion must never regress locally.
 *
 * Returns true when the record was consumed (applied or intentionally kept
 * local).
 */
export function applyLessonProgressRecord(
  record: SyncRecord | SyncPullRecord,
): boolean {
  const db = getDatabase();
  if (record.tombstone) {
    // Progress is never deleted; ignore a tombstone rather than regressing.
    return true;
  }
  const parsed = LessonProgressStatePayloadSchema.safeParse(record.payload);
  if (!parsed.success) {
    throw new Error(
      `Invalid lesson_progress payload for lesson ${record.entity_id}`,
    );
  }
  const remoteRank = lessonProgressRank(parsed.data.status);
  const existingRes = db.execute(
    'SELECT status FROM lesson_progress WHERE lesson_id = ? LIMIT 1;',
    [record.entity_id],
  );
  const existingRow = existingRes.rows?.item(0) as
    | {status?: unknown}
    | undefined;
  if (typeof existingRow?.status === 'string') {
    const localStatus = existingRow.status as 'in_progress' | 'completed';
    const localRank = lessonProgressRank(localStatus);
    if (remoteRank < localRank) {
      return true;
    }
    // AD-001 (INV-004): a locally completed row is final; consume without writing.
    if (localStatus === 'completed') {
      return true;
    }
  }
  db.execute(
    `INSERT OR REPLACE INTO lesson_progress (
      lesson_id, status, started_at, completed_at, revision,
      tombstone, updated_at
    ) VALUES (?, ?, ?, ?, ?, 0, ?);`,
    [
      record.entity_id,
      parsed.data.status,
      parsed.data.started_at,
      parsed.data.completed_at,
      record.revision,
      record.updated_at,
    ],
  );
  return true;
}

export function applySyncRecord(
  record: SyncRecord | SyncPullRecord,
  pendingUnlinks?: string[],
) {
  if (record.collection === LESSON_PROGRESS_EVENT_TYPE) {
    applyLessonProgressRecord(record);
    return;
  }
  if (record.collection === SPEAKING_ATTEMPTS_EVENT_TYPE) {
    applySpeakingAttemptRecord(record, pendingUnlinks);
    return;
  }
  if (!SyncCollectionSchema.safeParse(record.collection).success) {
    // AD-008: skip records of collections this build does not know instead of
    // throwing, so an unknown collection cannot stall paging. The cursor
    // still advances past the page.
    console.log(`[sync] skipping unknown collection: ${record.collection}`);
    return;
  }
  const db = getDatabase();
  const table = getTableForCollection(record.collection);

  // Get table info
  const pragmaRes = db.execute(`PRAGMA table_info(${table});`);
  if (!pragmaRes.rows || pragmaRes.rows.length === 0) {
    throw new Error(
      `Table ${table} does not exist for collection ${record.collection}`,
    );
  }

  const columns: string[] = [];
  const pks: string[] = [];
  for (let i = 0; i < pragmaRes.rows.length; i++) {
    const row = pragmaRes.rows.item(i);
    columns.push(row.name);
    if (row.pk > 0) pks.push(row.name);
  }

  if (pks.length === 0) {
    throw new Error(`Table ${table} has no primary key defined`);
  }

  const payload = mapToSnakeCase(record.payload);

  // Adapter defaults for specific collections
  if (record.collection === 'grammar_bookmarks') {
    const parts = record.entity_id.split(':');
    payload.lesson_id = payload.lesson_id ?? parts[0];
    payload.grammar_id = payload.grammar_id ?? parts[1];
    payload.package_id = payload.package_id ?? '';
    payload.saved_at = payload.saved_at ?? record.occurred_at;
    payload.reactivated_at =
      payload.reactivated_at !== undefined
        ? payload.reactivated_at
        : payload.active !== false
        ? record.occurred_at
        : null;
    payload.created_at = payload.created_at ?? record.occurred_at;
  } else if (record.collection === 'review_schedules') {
    payload.card_id = payload.card_id ?? record.entity_id;
  }

  // Extract PK values
  const pkValues = pks.map((pk, idx) => {
    if (payload[pk] !== undefined && payload[pk] !== null) {
      return payload[pk];
    }
    if (pks.length === 1) {
      return record.entity_id;
    }
    const parts = record.entity_id.split(':');
    return parts[idx] ?? record.entity_id;
  });

  // Check local revision
  const pkWhere = pks.map(pk => `${pk} = ?`).join(' AND ');
  const existingRes = db.execute(
    `SELECT revision FROM ${table} WHERE ${pkWhere} LIMIT 1;`,
    pkValues,
  );

  if (existingRes.rows && existingRes.rows.length > 0) {
    const localRev = existingRes.rows.item(0).revision;
    if (localRev === 0) {
      // Local changes pending sync, do not overwrite (local-first)
      return;
    }
    if (localRev >= record.revision) {
      // Stale record
      return;
    }
  }

  if (record.tombstone) {
    // apply tombstone
    if (columns.includes('tombstone')) {
      db.execute(
        `UPDATE ${table} SET tombstone = 1, revision = ?, updated_at = ? WHERE ${pkWhere};`,
        [record.revision, new Date().toISOString(), ...pkValues],
      );
    } else {
      db.execute(`DELETE FROM ${table} WHERE ${pkWhere};`, pkValues);
    }
    return;
  }

  // Insert or Replace
  const insertCols: string[] = [];
  const insertVals: any[] = [];

  for (const col of columns) {
    if (col === 'revision') {
      insertCols.push(col);
      insertVals.push(record.revision);
    } else if (col === 'tombstone') {
      insertCols.push(col);
      insertVals.push(record.tombstone ? 1 : 0);
    } else if (col === 'updated_at') {
      insertCols.push(col);
      insertVals.push(record.updated_at || new Date().toISOString());
    } else if (payload[col] !== undefined) {
      insertCols.push(col);
      insertVals.push(payload[col]);
    } else if (pks.includes(col)) {
      insertCols.push(col);
      insertVals.push(pkValues[pks.indexOf(col)]);
    }
  }

  const placeholders = insertCols.map(() => '?').join(', ');
  db.execute(
    `INSERT OR REPLACE INTO ${table} (${insertCols.join(
      ', ',
    )}) VALUES (${placeholders});`,
    insertVals,
  );
}

export async function runPullWorker() {
  if (isRunning || !isEnabled) return;
  isRunning = true;

  try {
    let cursor = getCursor();
    let hasMore = true;

    while (hasMore && isEnabled) {
      const res = await syncPull(cursor, 100);
      if (!isEnabled) {
        break;
      }
      if (!res.ok) {
        if (isEnabled) {
          retryTimer = setTimeout(runPullWorker, 5000);
        }
        break;
      }

      const db = getDatabase();
      let pageApplied = false;
      const pendingUnlinks: string[] = [];
      try {
        withTransaction(db, () => {
          for (const record of res.data.records) {
            applySyncRecord(record, pendingUnlinks);
          }
          cursor = res.data.next_cursor;
          saveCursor(cursor);
        });
        pageApplied = true;
        // Tombstone paths are collected for post-commit unlink (AD-004).
      } catch (_err) {
        // Rollback occurred. Do not advance cursor, schedule retry.
        if (isEnabled) {
          retryTimer = setTimeout(runPullWorker, 5000);
        }
        break;
      }

      if (!pageApplied) {
        break;
      }
      hasMore = res.data.has_more;
    }
  } finally {
    isRunning = false;
  }
}

export function startPullWorker() {
  if (isEnabled) return;
  isEnabled = true;
  runPullWorker();
  subscription?.remove();
  subscription = AppState.addEventListener(
    'change',
    (state: AppStateStatus) => {
      if (state === 'active' || state === 'background') {
        runPullWorker();
      }
    },
  );
}

export function stopPullWorker() {
  isEnabled = false;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  subscription?.remove();
  subscription = null;
}
