import {createRequestId} from '@core/api/requestId';
import {getDatabase, withTransaction} from '@core/db/database';
import {enqueueSyncOutboxEvent} from '@core/db/syncOutboxCore';
import type {
  GrammarBookmark,
  SaveGrammarBookmarkInput,
  SaveGrammarBookmarkResult,
} from '@core/db/types';

type GrammarBookmarkRow = {
  lesson_id: string;
  grammar_id: string;
  package_id: string;
  saved_at: string;
  reactivated_at: string | null;
  created_at: string;
  updated_at: string;
  revision?: number;
  tombstone?: number;
};

function mapRowToRecord(row: GrammarBookmarkRow): GrammarBookmark {
  return {
    lessonId: row.lesson_id,
    grammarId: row.grammar_id,
    packageId: row.package_id,
    savedAt: row.saved_at,
    reactivatedAt: row.reactivated_at,
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

export function getGrammarBookmark(
  lessonId: string,
  grammarId: string,
): GrammarBookmark | null {
  const db = getDatabase();
  const result = db.execute(
    'SELECT * FROM grammar_bookmarks WHERE lesson_id = ? AND grammar_id = ? LIMIT 1;',
    [lessonId, grammarId],
  );

  const row = firstRow<GrammarBookmarkRow>(result);
  if (!row) {
    return null;
  }

  return mapRowToRecord(row);
}

export function saveGrammarBookmark(
  input: SaveGrammarBookmarkInput,
): SaveGrammarBookmarkResult {
  try {
    const db = getDatabase();
    const now = input.now ?? new Date().toISOString();
    const existing = firstRow<GrammarBookmarkRow>(
      db.execute(
        'SELECT * FROM grammar_bookmarks WHERE lesson_id = ? AND grammar_id = ? LIMIT 1;',
        [input.lessonId, input.grammarId],
      ),
    );

    if (existing) {
      withTransaction(db, () => {
        db.execute(
          `UPDATE grammar_bookmarks
           SET reactivated_at = ?, saved_at = ?, updated_at = ?
           WHERE lesson_id = ? AND grammar_id = ?;`,
          [now, now, now, input.lessonId, input.grammarId],
        );
        enqueueSyncOutboxEvent({
          id: createRequestId(),
          eventType: 'grammar_bookmarks',
          entityId: `${input.lessonId}:${input.grammarId}`,
          payload: {
            lessonId: input.lessonId,
            grammarId: input.grammarId,
            packageId: existing.package_id || input.packageId,
            savedAt: now,
            reactivatedAt: now,
            active: true,
          },
          createdAt: now,
        });
      });
      return {ok: true, duplicate: true};
    }

    withTransaction(db, () => {
      db.execute(
        `INSERT INTO grammar_bookmarks (
          lesson_id, grammar_id, package_id, saved_at, reactivated_at,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [input.lessonId, input.grammarId, input.packageId, now, now, now, now],
      );
      enqueueSyncOutboxEvent({
        id: createRequestId(),
        eventType: 'grammar_bookmarks',
        entityId: `${input.lessonId}:${input.grammarId}`,
        payload: {
          lessonId: input.lessonId,
          grammarId: input.grammarId,
          packageId: input.packageId,
          savedAt: now,
          reactivatedAt: now,
          active: true,
        },
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

export function unsaveGrammarBookmark(
  lessonId: string,
  grammarId: string,
  updatedAt = new Date().toISOString(),
): boolean {
  try {
    const db = getDatabase();
    const result = withTransaction(db, () => {
      const res = db.execute(
        `UPDATE grammar_bookmarks
         SET reactivated_at = NULL, updated_at = ?
         WHERE lesson_id = ? AND grammar_id = ?;`,
        [updatedAt, lessonId, grammarId],
      );
      if ((res.rowsAffected ?? 0) > 0) {
        enqueueSyncOutboxEvent({
          id: createRequestId(),
          eventType: 'grammar_bookmarks',
          entityId: `${lessonId}:${grammarId}`,
          payload: {lessonId, grammarId, active: false},
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

export function listBookmarkedGrammar(lessonId: string): GrammarBookmark[] {
  const db = getDatabase();
  const result = db.execute(
    `SELECT * FROM grammar_bookmarks
     WHERE lesson_id = ? AND reactivated_at IS NOT NULL
     ORDER BY datetime(updated_at) DESC;`,
    [lessonId],
  );

  const items: GrammarBookmark[] = [];
  const rows = result.rows;
  if (!rows) {
    return items;
  }

  for (let index = 0; index < rows.length; index += 1) {
    items.push(mapRowToRecord(rows.item(index) as GrammarBookmarkRow));
  }

  return items;
}

export function listAllBookmarkedGrammar(): GrammarBookmark[] {
  const db = getDatabase();
  const result = db.execute(
    `SELECT * FROM grammar_bookmarks
     WHERE reactivated_at IS NOT NULL
     ORDER BY datetime(updated_at) DESC;`,
    [],
  );

  const items: GrammarBookmark[] = [];
  const rows = result.rows;
  if (!rows) {
    return items;
  }

  for (let index = 0; index < rows.length; index += 1) {
    items.push(mapRowToRecord(rows.item(index) as GrammarBookmarkRow));
  }

  return items;
}
