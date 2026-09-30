import {createRequestId} from '@core/api/requestId';
import {getDatabase, withTransaction} from '@core/db/database';
import {enqueueSyncOutboxEvent} from '@core/db/syncOutboxCore';
import {
  type YouTubeSegment,
  type YouTubeTranscript,
  YouTubeTranscriptSchema,
} from '@core/schemas/youtube-transcript-v1';

type YouTubeLessonRow = {
  id: string;
  schema_version: string;
  video_id: string;
  title: string;
  channel_title: string;
  duration_seconds: number;
  language: string;
  embeddable: number;
  transcript_source: YouTubeTranscript['transcript_source'];
  warnings_json: string;
  created_at: string;
  updated_at: string;
};

type YouTubeSentenceRow = {
  sentence_id: string;
  idx: number;
  start_ms: number;
  end_ms: number;
  en: string;
  vi: string;
  ipa: string;
};

export type SaveYouTubeLessonInput = {
  lesson: YouTubeTranscript;
  now?: string;
};

export type SaveYouTubeLessonResult =
  | {ok: true; lessonId: string; duplicate: boolean}
  | {ok: false; errorCode: 'INVALID_PAYLOAD' | 'LOCAL_DB_ERROR'};

function rows<T>(result: {
  rows?: {length: number; item(index: number): unknown};
}): T[] {
  const resultRows: T[] = [];
  for (let index = 0; index < (result.rows?.length ?? 0); index += 1) {
    resultRows.push(result.rows?.item(index) as T);
  }
  return resultRows;
}

function firstRow<T>(result: {
  rows?: {item: (index: number) => unknown};
}): T | null {
  return (result.rows?.item(0) as T | undefined) ?? null;
}

function mapLesson(
  row: YouTubeLessonRow,
  sentenceRows: YouTubeSentenceRow[],
): YouTubeTranscript {
  const segments: YouTubeSegment[] = sentenceRows
    .sort((a, b) => a.idx - b.idx)
    .map(sentence => ({
      id: sentence.sentence_id,
      index: sentence.idx,
      start_ms: sentence.start_ms,
      end_ms: sentence.end_ms,
      en: sentence.en,
      vi: sentence.vi,
      ipa: sentence.ipa,
    }));

  return {
    schema_version: row.schema_version as YouTubeTranscript['schema_version'],
    video: {
      id: row.video_id,
      title: row.title,
      channel_title: row.channel_title,
      duration_seconds: row.duration_seconds,
      language: row.language,
      embeddable: row.embeddable === 1,
    },
    transcript_source: row.transcript_source,
    segments,
    warnings: JSON.parse(row.warnings_json) as string[],
  };
}

function readLesson(lessonId: string): YouTubeTranscript | null {
  const db = getDatabase();
  const lesson = firstRow<YouTubeLessonRow>(
    db.execute('SELECT * FROM youtube_lessons WHERE id = ? LIMIT 1;', [
      lessonId,
    ]),
  );
  if (!lesson) {
    return null;
  }

  const sentences = rows<YouTubeSentenceRow>(
    db.execute(
      'SELECT * FROM youtube_sentences WHERE lesson_id = ? ORDER BY idx ASC;',
      [lessonId],
    ),
  );
  return mapLesson(lesson, sentences);
}

export function saveYouTubeLesson(
  input: SaveYouTubeLessonInput,
): SaveYouTubeLessonResult {
  const parsed = YouTubeTranscriptSchema.safeParse(input.lesson);
  if (!parsed.success) {
    return {ok: false, errorCode: 'INVALID_PAYLOAD'};
  }

  const lesson = parsed.data;
  const db = getDatabase();
  const now = input.now ?? new Date().toISOString();
  const existing = firstRow<YouTubeLessonRow>(
    db.execute('SELECT id FROM youtube_lessons WHERE id = ? LIMIT 1;', [
      lesson.video.id,
    ]),
  );

  try {
    withTransaction(db, () => {
      db.execute('DELETE FROM youtube_sentences WHERE lesson_id = ?;', [
        lesson.video.id,
      ]);
      db.execute(
        `INSERT OR REPLACE INTO youtube_lessons (
          id, schema_version, video_id, title, channel_title, duration_seconds,
          language, embeddable, transcript_source, warnings_json, created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          COALESCE((SELECT created_at FROM youtube_lessons WHERE id = ?), ?), ?);`,
        [
          lesson.video.id,
          lesson.schema_version,
          lesson.video.id,
          lesson.video.title,
          lesson.video.channel_title,
          lesson.video.duration_seconds,
          lesson.video.language,
          lesson.video.embeddable ? 1 : 0,
          lesson.transcript_source,
          JSON.stringify(lesson.warnings),
          lesson.video.id,
          now,
          now,
        ],
      );

      for (const segment of lesson.segments) {
        db.execute(
          `INSERT INTO youtube_sentences (
            lesson_id, sentence_id, idx, start_ms, end_ms, en, vi, ipa
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            lesson.video.id,
            segment.id,
            segment.index,
            segment.start_ms,
            segment.end_ms,
            segment.en,
            segment.vi,
            segment.ipa,
          ],
        );
      }

      enqueueSyncOutboxEvent({
        id: createRequestId(),
        eventType: 'youtube_lessons',
        entityId: lesson.video.id,
        payload: lesson as any,
        createdAt: now,
      });
    });
    return {ok: true, lessonId: lesson.video.id, duplicate: existing !== null};
  } catch {
    return {ok: false, errorCode: 'LOCAL_DB_ERROR'};
  }
}

export function getYouTubeLesson(lessonId: string): YouTubeTranscript | null {
  return readLesson(lessonId);
}

export function listYouTubeLessons(): YouTubeTranscript[] {
  const db = getDatabase();
  const lessonRows = rows<YouTubeLessonRow>(
    db.execute(
      'SELECT * FROM youtube_lessons ORDER BY datetime(updated_at) DESC;',
      [],
    ),
  );
  return lessonRows.flatMap(row => {
    const lesson = readLesson(row.id);
    return lesson ? [lesson] : [];
  });
}

export function countYouTubeLessons(): number {
  try {
    const db = getDatabase();
    const result = firstRow<{count: number}>(
      db.execute('SELECT COUNT(*) as count FROM youtube_lessons;', []),
    );
    return result?.count ?? 0;
  } catch {
    return 0;
  }
}

export function deleteYouTubeLesson(lessonId: string): boolean {
  try {
    const db = getDatabase();
    return withTransaction(db, () => {
      db.execute('DELETE FROM youtube_sentences WHERE lesson_id = ?;', [
        lessonId,
      ]);
      // SETE-290 (DEV-3): resume progress lives and dies with its lesson.
      db.execute('DELETE FROM youtube_progress WHERE lesson_id = ?;', [
        lessonId,
      ]);
      const result = db.execute('DELETE FROM youtube_lessons WHERE id = ?;', [
        lessonId,
      ]);
      return (result.rowsAffected ?? 0) > 0;
    });
  } catch {
    return false;
  }
}

// Kept as a compatibility spelling for call sites that mirror the legacy spelling.
export const saveYoutubeLesson = saveYouTubeLesson;
export const getYoutubeLesson = getYouTubeLesson;
export const listYoutubeLessons = listYouTubeLessons;
export const countYoutubeLessons = countYouTubeLessons;
export const deleteYoutubeLesson = deleteYouTubeLesson;
