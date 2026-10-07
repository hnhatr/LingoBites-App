import {createRequestId} from '@core/api/requestId';
import {getDatabase, withTransaction} from '@core/db/database';
import {enqueueSyncOutboxEvent} from '@core/db/syncOutboxCore';
import type {LessonSourceType} from '@core/schemas/lesson';
import {
  type LessonBookmarkPayload,
  LessonBookmarkPayloadSchema,
  type SyncPullRecord,
  type SyncRecord,
} from '@core/schemas/sync';

/** Outbox event type and sync collection name (schema v6). */
export const LESSON_BOOKMARKS_EVENT_TYPE = 'lesson_bookmarks' as const;

export type LessonBookmark = {
  lessonId: string;
  title: string;
  sourceType: LessonSourceType;
  sentenceCount: number;
  estimatedMinutes: number | null;
  contextLabel: string | null;
  savedAt: string;
};

export type SaveLessonBookmarkInput = {
  lessonId: string;
  title: string;
  sourceType: LessonSourceType;
  sentenceCount: number;
  estimatedMinutes?: number | null;
  contextLabel?: string | null;
  now?: string;
};

type LessonBookmarkRow = {
  lesson_id: string;
  title: string;
  source_type: string;
  sentence_count: number;
  estimated_minutes: number | null;
  context_label: string | null;
  saved_at: string;
  updated_at: string;
  revision: number;
  tombstone: number;
};

const listeners = new Set<() => void>();

/** Called after any local or pulled bookmark change. Returns an unsubscribe. */
export function subscribeLessonBookmarks(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyLessonBookmarkListeners(): void {
  for (const listener of [...listeners]) {
    listener();
  }
}

function toPayload(
  input: SaveLessonBookmarkInput,
): LessonBookmarkPayload | null {
  const minutes =
    input.estimatedMinutes != null && input.estimatedMinutes >= 1
      ? Math.round(input.estimatedMinutes)
      : null;
  const context = input.contextLabel?.trim() ?? '';
  const parsed = LessonBookmarkPayloadSchema.safeParse({
    title: input.title.trim().slice(0, 500),
    source_type: input.sourceType,
    sentence_count: Math.max(0, Math.round(input.sentenceCount)),
    estimated_minutes: minutes,
    context_label: context.length > 0 ? context.slice(0, 255) : null,
  });
  return parsed.success ? parsed.data : null;
}

function mapRow(row: LessonBookmarkRow): LessonBookmark {
  return {
    lessonId: row.lesson_id,
    title: row.title,
    sourceType: row.source_type as LessonSourceType,
    sentenceCount: row.sentence_count,
    estimatedMinutes: row.estimated_minutes,
    contextLabel: row.context_label,
    savedAt: row.saved_at,
  };
}

function readRow(lessonId: string): LessonBookmarkRow | null {
  const result = getDatabase().execute(
    'SELECT * FROM lesson_bookmarks WHERE lesson_id = ? LIMIT 1;',
    [lessonId],
  );
  return (result.rows?.item(0) as LessonBookmarkRow | undefined) ?? null;
}

/**
 * Saves a lesson for later and queues the sync mutation in the same
 * transaction. Saving an already-saved lesson refreshes its card fields.
 */
export function saveLessonBookmark(input: SaveLessonBookmarkInput): boolean {
  const payload = toPayload(input);
  if (!payload) {
    return false;
  }
  const now = input.now ?? new Date().toISOString();
  try {
    const db = getDatabase();
    withTransaction(db, () => {
      db.execute(
        `INSERT OR REPLACE INTO lesson_bookmarks (
          lesson_id, title, source_type, sentence_count, estimated_minutes,
          context_label, saved_at, updated_at, revision, tombstone
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0);`,
        [
          input.lessonId,
          payload.title,
          payload.source_type,
          payload.sentence_count,
          payload.estimated_minutes,
          payload.context_label,
          now,
          now,
        ],
      );
      enqueueSyncOutboxEvent({
        id: createRequestId(),
        eventType: LESSON_BOOKMARKS_EVENT_TYPE,
        entityId: input.lessonId,
        payload,
        createdAt: now,
      });
    });
  } catch {
    return false;
  }
  notifyLessonBookmarkListeners();
  return true;
}

/** Unsaves a lesson (a tombstone on sync). False when it was not saved. */
export function removeLessonBookmark(
  lessonId: string,
  now: string = new Date().toISOString(),
): boolean {
  let removed = false;
  try {
    const db = getDatabase();
    withTransaction(db, () => {
      const res = db.execute(
        `UPDATE lesson_bookmarks
            SET tombstone = 1, updated_at = ?, revision = 0
          WHERE lesson_id = ? AND tombstone = 0;`,
        [now, lessonId],
      );
      if ((res.rowsAffected ?? 0) === 0) {
        return;
      }
      enqueueSyncOutboxEvent({
        id: createRequestId(),
        eventType: LESSON_BOOKMARKS_EVENT_TYPE,
        entityId: lessonId,
        payload: {tombstone: true},
        createdAt: now,
      });
      removed = true;
    });
  } catch {
    return false;
  }
  if (removed) {
    notifyLessonBookmarkListeners();
  }
  return removed;
}

export function isLessonBookmarked(lessonId: string): boolean {
  const row = readRow(lessonId);
  return row !== null && row.tombstone === 0;
}

/** Saved lessons, most recently saved first. */
export function listLessonBookmarks(): LessonBookmark[] {
  const result = getDatabase().execute(
    `SELECT * FROM lesson_bookmarks
      WHERE tombstone = 0
      ORDER BY saved_at DESC;`,
  );
  const bookmarks: LessonBookmark[] = [];
  for (let index = 0; index < (result.rows?.length ?? 0); index += 1) {
    bookmarks.push(mapRow(result.rows!.item(index) as LessonBookmarkRow));
  }
  return bookmarks;
}

/**
 * Applies one pulled `lesson_bookmarks` record, last writer wins by time: a
 * local change made after the record's `occurred_at` is kept (it is still in
 * the outbox and will win on the server too). A record whose payload does not
 * parse is skipped rather than thrown, so it can never stall paging.
 */
export function applyLessonBookmarkRecord(
  record: SyncRecord | SyncPullRecord,
): void {
  const local = readRow(record.entity_id);
  if (local && local.updated_at > record.occurred_at) {
    return;
  }
  const db = getDatabase();
  if (record.tombstone) {
    if (local) {
      db.execute(
        `UPDATE lesson_bookmarks
            SET tombstone = 1, updated_at = ?, revision = ?
          WHERE lesson_id = ?;`,
        [record.occurred_at, record.revision, record.entity_id],
      );
      notifyLessonBookmarkListeners();
    }
    return;
  }
  const parsed = LessonBookmarkPayloadSchema.safeParse(record.payload);
  if (!parsed.success) {
    return;
  }
  db.execute(
    `INSERT OR REPLACE INTO lesson_bookmarks (
      lesson_id, title, source_type, sentence_count, estimated_minutes,
      context_label, saved_at, updated_at, revision, tombstone
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0);`,
    [
      record.entity_id,
      parsed.data.title,
      parsed.data.source_type,
      parsed.data.sentence_count,
      parsed.data.estimated_minutes,
      parsed.data.context_label,
      record.occurred_at,
      record.occurred_at,
      record.revision,
    ],
  );
  notifyLessonBookmarkListeners();
}
