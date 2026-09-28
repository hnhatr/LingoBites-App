import {getDatabase} from '@shared/db/database';

export type YouTubeProgress = {
  lessonId: string;
  positionMs: number;
  segmentIndex: number;
  updatedAt: string;
  revision: number;
  tombstone: boolean;
};

type YouTubeProgressRow = {
  lesson_id: string;
  position_ms: number;
  segment_index: number;
  updated_at: string;
  revision?: number;
  tombstone?: number;
};

function firstRow(result: {
  rows?: {item: (index: number) => unknown};
}): YouTubeProgressRow | null {
  return (result.rows?.item(0) as YouTubeProgressRow | undefined) ?? null;
}

/**
 * SETE-290 (DEV-3): per-video resume progress. Each saved lesson owns at
 * most one row, keyed by lesson id — watching video A never overwrites
 * video B. Rows live and die with their lesson: `deleteYouTubeLesson`
 * removes the progress row in the same transaction.
 */
export function getYouTubeProgress(lessonId: string): YouTubeProgress | null {
  try {
    const db = getDatabase();
    const row = firstRow(
      db.execute(
        'SELECT * FROM youtube_progress WHERE lesson_id = ? LIMIT 1;',
        [lessonId],
      ),
    );
    if (!row) {
      return null;
    }
    const positionMs = Math.max(0, Math.floor(row.position_ms));
    const segmentIndex = Math.max(0, Math.floor(row.segment_index));
    return {
      lessonId: row.lesson_id,
      positionMs,
      segmentIndex,
      updatedAt: row.updated_at,
      revision: row.revision || 0,
      tombstone: Boolean(row.tombstone),
    };
  } catch {
    return null;
  }
}

export function saveYouTubeProgress(input: {
  lessonId: string;
  positionMs: number;
  segmentIndex: number;
  now?: string;
}): boolean {
  try {
    const db = getDatabase();
    const now = input.now ?? new Date().toISOString();
    db.execute(
      `INSERT OR REPLACE INTO youtube_progress (
        lesson_id, position_ms, segment_index, updated_at
      ) VALUES (?, ?, ?, ?);`,
      [
        input.lessonId,
        Math.max(0, Math.floor(input.positionMs)),
        Math.max(0, Math.floor(input.segmentIndex)),
        now,
      ],
    );
    return true;
  } catch {
    return false;
  }
}

export function clearYouTubeProgress(lessonId: string): boolean {
  try {
    const db = getDatabase();
    db.execute('DELETE FROM youtube_progress WHERE lesson_id = ?;', [lessonId]);
    return true;
  } catch {
    return false;
  }
}
