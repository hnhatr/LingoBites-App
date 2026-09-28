import {getDatabase, withTransaction} from '@core/db/database';
import {enqueueSyncOutboxEvent} from '@core/db/syncOutboxCore';
import {createRequestId} from '@core/api/requestId';
import type {
  ContentLessonState,
  SaveContentLessonInput,
  SaveContentLessonResult,
} from '@core/db/types';

type ContentLessonStateRow = {
  lesson_id: string;
  is_saved: number;
  is_started: number;
  created_at: string;
  updated_at: string;
  revision?: number;
  tombstone?: number;
};

function mapRowToRecord(row: ContentLessonStateRow): ContentLessonState {
  return {
    lessonId: row.lesson_id,
    isSaved: row.is_saved === 1,
    isStarted: row.is_started === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revision: row.revision || 0,
    tombstone: Boolean(row.tombstone),
  };
}

function firstRow<T>(result: {
  rows?: {item: (index: number) => unknown};
}): T | null {
  return (result.rows?.item(0) as T | undefined) ?? null;
}

export function getContentLessonState(
  lessonId: string,
): ContentLessonState | null {
  const db = getDatabase();
  const result = db.execute(
    'SELECT * FROM content_lesson_state WHERE lesson_id = ? LIMIT 1;',
    [lessonId],
  );

  const row = firstRow<ContentLessonStateRow>(result);
  if (!row) {
    return null;
  }

  return mapRowToRecord(row);
}

export function saveContentLesson(
  input: SaveContentLessonInput,
): SaveContentLessonResult {
  try {
    const db = getDatabase();
    const now = input.now ?? new Date().toISOString();
    const existing = firstRow<ContentLessonStateRow>(
      db.execute(
        'SELECT * FROM content_lesson_state WHERE lesson_id = ? LIMIT 1;',
        [input.lessonId],
      ),
    );

    if (existing) {
      withTransaction(db, () => {
        db.execute(
          'UPDATE content_lesson_state SET is_saved = 1, updated_at = ? WHERE lesson_id = ?;',
          [now, input.lessonId],
        );
        enqueueSyncOutboxEvent({
          id: createRequestId(),
          eventType: 'content_lesson_state',
          entityId: input.lessonId,
          payload: {lessonId: input.lessonId, isSaved: 1},
          createdAt: now,
        });
      });
      return {ok: true, duplicate: true};
    }

    withTransaction(db, () => {
      db.execute(
        `INSERT INTO content_lesson_state (
          lesson_id, is_saved, is_started, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?);`,
        [input.lessonId, 1, 0, now, now],
      );
      enqueueSyncOutboxEvent({
        id: createRequestId(),
        eventType: 'content_lesson_state',
        entityId: input.lessonId,
        payload: {lessonId: input.lessonId, isSaved: 1},
        createdAt: now,
      });
    });
    return {ok: true, duplicate: false};
  } catch {
    return {
      ok: false,
      errorCode: 'LOCAL_DB_ERROR',
    };
  }
}

export function unsaveContentLesson(
  lessonId: string,
  updatedAt = new Date().toISOString(),
): boolean {
  try {
    const db = getDatabase();
    const result = withTransaction(db, () => {
      const res = db.execute(
        'UPDATE content_lesson_state SET is_saved = 0, updated_at = ? WHERE lesson_id = ?;',
        [updatedAt, lessonId],
      );
      if ((res.rowsAffected ?? 0) > 0) {
        enqueueSyncOutboxEvent({
          id: createRequestId(),
          eventType: 'content_lesson_state',
          entityId: lessonId,
          payload: {lessonId, isSaved: 0},
          createdAt: updatedAt,
        });
      }
      return res;
    });
    return (result.rowsAffected ?? 0) > 0;
  } catch {
    return false;
  }
}

export function startContentLesson(
  input: SaveContentLessonInput,
): SaveContentLessonResult {
  try {
    const db = getDatabase();
    const now = input.now ?? new Date().toISOString();
    const existing = firstRow<ContentLessonStateRow>(
      db.execute(
        'SELECT * FROM content_lesson_state WHERE lesson_id = ? LIMIT 1;',
        [input.lessonId],
      ),
    );

    if (existing) {
      withTransaction(db, () => {
        db.execute(
          'UPDATE content_lesson_state SET is_started = 1, updated_at = ? WHERE lesson_id = ?;',
          [now, input.lessonId],
        );
        enqueueSyncOutboxEvent({
          id: createRequestId(),
          eventType: 'content_lesson_state',
          entityId: input.lessonId,
          payload: {lessonId: input.lessonId, isStarted: 1},
          createdAt: now,
        });
      });
      return {ok: true, duplicate: true};
    }

    withTransaction(db, () => {
      db.execute(
        `INSERT INTO content_lesson_state (
          lesson_id, is_saved, is_started, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?);`,
        [input.lessonId, 0, 1, now, now],
      );
      enqueueSyncOutboxEvent({
        id: createRequestId(),
        eventType: 'content_lesson_state',
        entityId: input.lessonId,
        payload: {lessonId: input.lessonId, isStarted: 1},
        createdAt: now,
      });
    });
    return {ok: true, duplicate: false};
  } catch {
    return {
      ok: false,
      errorCode: 'LOCAL_DB_ERROR',
    };
  }
}

export function unstartContentLesson(
  lessonId: string,
  updatedAt = new Date().toISOString(),
): boolean {
  try {
    const db = getDatabase();
    const result = withTransaction(db, () => {
      const res = db.execute(
        'UPDATE content_lesson_state SET is_started = 0, updated_at = ? WHERE lesson_id = ?;',
        [updatedAt, lessonId],
      );
      if ((res.rowsAffected ?? 0) > 0) {
        enqueueSyncOutboxEvent({
          id: createRequestId(),
          eventType: 'content_lesson_state',
          entityId: lessonId,
          payload: {lessonId, isStarted: 0},
          createdAt: updatedAt,
        });
      }
      return res;
    });
    return (result.rowsAffected ?? 0) > 0;
  } catch {
    return false;
  }
}

export function listSavedLessons(): ContentLessonState[] {
  const db = getDatabase();
  const result = db.execute(
    'SELECT * FROM content_lesson_state WHERE is_saved = 1 ORDER BY datetime(updated_at) DESC;',
    [],
  );

  const items: ContentLessonState[] = [];
  const rows = result.rows;
  if (!rows) {
    return items;
  }

  for (let index = 0; index < rows.length; index += 1) {
    items.push(mapRowToRecord(rows.item(index) as ContentLessonStateRow));
  }

  return items;
}

export function listStartedLessons(): ContentLessonState[] {
  const db = getDatabase();
  const result = db.execute(
    'SELECT * FROM content_lesson_state WHERE is_started = 1 ORDER BY datetime(updated_at) DESC;',
    [],
  );

  const items: ContentLessonState[] = [];
  const rows = result.rows;
  if (!rows) {
    return items;
  }

  for (let index = 0; index < rows.length; index += 1) {
    items.push(mapRowToRecord(rows.item(index) as ContentLessonStateRow));
  }

  return items;
}
