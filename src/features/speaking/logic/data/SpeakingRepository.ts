/**
 * Repository for the Speaking Room recordings and the automatic Error
 * Notebook (SETE-110 / M5).
 *
 * Recording metadata lives in `speaking_recordings`; audio bytes live on
 * disk under the app's documents/cache directory and are addressed here
 * only by `filePath` (deletion of the file itself is the caller's job — see
 * `deleteRecording`, which returns the path to delete).
 *
 * A captured error event (`error_events`) stores remediation metadata locally
 * without the retired package SRS tables (LING-149 TASK-008).
 */

import {getDatabase} from '@core/db/database';
import type {
  CaptureErrorEventInput,
  ErrorEventRecord,
  InsertSpeakingRecordingInput,
  SpeakingRecordingRecord,
} from '@core/db/types';

type SpeakingRecordingDbRow = {
  id: string;
  activity_id: string | null;
  lesson_id: string | null;
  mode: string;
  file_path: string;
  duration_ms: number;
  created_at: string;
};

type ErrorEventDbRow = {
  id: string;
  source: string;
  category: string;
  activity_id: string | null;
  lesson_id: string | null;
  review_item_id: string | null;
  created_at: string;
};

function mapRecordingRow(row: SpeakingRecordingDbRow): SpeakingRecordingRecord {
  return {
    id: row.id,
    activityId: row.activity_id,
    lessonId: row.lesson_id,
    mode: row.mode as SpeakingRecordingRecord['mode'],
    filePath: row.file_path,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
  };
}

function mapErrorEventRow(row: ErrorEventDbRow): ErrorEventRecord {
  return {
    id: row.id,
    source: row.source as ErrorEventRecord['source'],
    category: row.category as ErrorEventRecord['category'],
    activityId: row.activity_id,
    lessonId: row.lesson_id,
    reviewItemId: row.review_item_id,
    createdAt: row.created_at,
  };
}

export function insertSpeakingRecording(
  input: InsertSpeakingRecordingInput,
): SpeakingRecordingRecord {
  const db = getDatabase();
  const createdAt = input.createdAt ?? new Date().toISOString();
  db.execute(
    `INSERT INTO speaking_recordings (
      id, activity_id, lesson_id, mode, file_path, duration_ms, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      input.id,
      input.activityId ?? null,
      input.lessonId ?? null,
      input.mode,
      input.filePath,
      input.durationMs,
      createdAt,
    ],
  );
  return {
    id: input.id,
    activityId: input.activityId ?? null,
    lessonId: input.lessonId ?? null,
    mode: input.mode,
    filePath: input.filePath,
    durationMs: input.durationMs,
    createdAt,
  };
}

export function listSpeakingRecordings(
  lessonId?: string,
): SpeakingRecordingRecord[] {
  const db = getDatabase();
  const result = lessonId
    ? db.execute('SELECT * FROM speaking_recordings WHERE lesson_id = ?;', [
        lessonId,
      ])
    : db.execute('SELECT * FROM speaking_recordings;');
  const rows = result.rows;
  const items: SpeakingRecordingRecord[] = [];
  if (!rows) {
    return items;
  }
  for (let i = 0; i < rows.length; i += 1) {
    items.push(mapRecordingRow(rows.item(i) as SpeakingRecordingDbRow));
  }
  return items;
}

/** Deletes the DB row and returns the file path so the caller can unlink it. */
export function deleteSpeakingRecording(id: string): {filePath: string} | null {
  const db = getDatabase();
  const result = db.execute('SELECT * FROM speaking_recordings WHERE id = ?;', [
    id,
  ]);
  const row = result.rows?.item(0) as SpeakingRecordingDbRow | undefined;
  if (!row) {
    return null;
  }
  db.execute('DELETE FROM speaking_recordings WHERE id = ?;', [id]);
  return {filePath: row.file_path};
}

export function listErrorEvents(lessonId?: string): ErrorEventRecord[] {
  const db = getDatabase();
  const result = lessonId
    ? db.execute('SELECT * FROM error_events WHERE lesson_id = ?;', [lessonId])
    : db.execute('SELECT * FROM error_events;');
  const rows = result.rows;
  const items: ErrorEventRecord[] = [];
  if (!rows) {
    return items;
  }
  for (let i = 0; i < rows.length; i += 1) {
    items.push(mapErrorEventRow(rows.item(i) as ErrorEventDbRow));
  }
  return items;
}

/**
 * Records a failed/weak attempt as an `error_events` row (REQ-28/29, VC-18).
 */
export function captureErrorEvent(input: CaptureErrorEventInput): {
  errorEvent: ErrorEventRecord;
  reviewItemId: string;
} {
  const db = getDatabase();
  const createdAt = input.createdAt ?? new Date().toISOString();
  const reviewItemId = `speaking-error-${input.id}`;

  db.execute(
    `INSERT INTO error_events (
      id, source, category, activity_id, lesson_id, review_item_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      input.id,
      input.source,
      input.category,
      input.activityId ?? null,
      input.lessonId ?? null,
      reviewItemId,
      createdAt,
    ],
  );

  return {
    errorEvent: {
      id: input.id,
      source: input.source,
      category: input.category,
      activityId: input.activityId ?? null,
      lessonId: input.lessonId ?? null,
      reviewItemId,
      createdAt,
    },
    reviewItemId,
  };
}

/**
 * CHANGE-S3 delete-my-data: removes all recordings rows and error events.
 * Returns the file paths of deleted recordings so the caller can unlink them
 * from disk.
 */
/**
 * File paths for all managed recordings — collect before deleting metadata.
 */
export function listSpeakingRecordingFilePaths(): string[] {
  const db = getDatabase();
  const result = db.execute('SELECT file_path FROM speaking_recordings;');
  const rows = result.rows;
  const filePaths: string[] = [];
  if (rows) {
    for (let i = 0; i < rows.length; i += 1) {
      filePaths.push((rows.item(i) as {file_path: string}).file_path);
    }
  }
  return filePaths;
}

export function clearSpeakingData(): {deletedFilePaths: string[]} {
  const deletedFilePaths = listSpeakingRecordingFilePaths();
  const db = getDatabase();
  db.execute('DELETE FROM speaking_recordings;');
  db.execute('DELETE FROM error_events;');
  return {deletedFilePaths};
}
