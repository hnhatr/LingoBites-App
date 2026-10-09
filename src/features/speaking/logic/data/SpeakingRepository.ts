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
  RecordingUploadState,
  SpeakingMode,
  SpeakingRecordingRecord,
  SpeakingRecordingRecordV4,
} from '@core/db/types';

type SpeakingRecordingDbRow = {
  id: string;
  activity_id: string | null;
  lesson_id: string | null;
  mode: string;
  file_path: string;
  duration_ms: number;
  created_at: string;
  sentence_id?: string | null;
  owner_user_id?: string | null;
  upload_state?: string;
  upload_attempts?: number;
  upload_next_at?: string | null;
  upload_error?: string | null;
  server_recording_id?: string | null;
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

function mapRecordingRowV4(
  row: SpeakingRecordingDbRow,
): SpeakingRecordingRecordV4 {
  const base = mapRecordingRow(row);
  return {
    ...base,
    sentenceId: row.sentence_id ?? null,
    ownerUserId: row.owner_user_id ?? null,
    uploadState: (row.upload_state ?? 'local_only') as RecordingUploadState,
    uploadAttempts: row.upload_attempts ?? 0,
    uploadNextAt: row.upload_next_at ?? null,
    uploadError: row.upload_error ?? null,
    serverRecordingId: row.server_recording_id ?? null,
  };
}

export type InsertSpeakingRecordingV4Input = {
  id: string;
  lessonId: string;
  sentenceId: string;
  mode: SpeakingMode;
  filePath: string;
  durationMs: number;
  createdAt?: string;
  ownerUserId: string | null;
  uploadState: RecordingUploadState;
};

export function findSpeakingRecordingById(
  id: string,
): SpeakingRecordingRecordV4 | null {
  const db = getDatabase();
  const row = db
    .execute('SELECT * FROM speaking_recordings WHERE id = ? LIMIT 1;', [id])
    .rows?.item(0) as SpeakingRecordingDbRow | undefined;
  return row ? mapRecordingRowV4(row) : null;
}

export function insertSpeakingRecordingV4(
  input: InsertSpeakingRecordingV4Input,
): SpeakingRecordingRecordV4 {
  const db = getDatabase();
  const createdAt = input.createdAt ?? new Date().toISOString();
  db.execute(
    `INSERT INTO speaking_recordings (
      id, activity_id, lesson_id, mode, file_path, duration_ms, created_at,
      sentence_id, owner_user_id, upload_state, upload_attempts,
      upload_next_at, upload_error, server_recording_id
    ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, NULL);`,
    [
      input.id,
      input.lessonId,
      input.mode,
      input.filePath,
      input.durationMs,
      createdAt,
      input.sentenceId,
      input.ownerUserId,
      input.uploadState,
    ],
  );
  return findSpeakingRecordingById(input.id)!;
}

function countSpeakingRecordingsWithFilePath(
  filePath: string,
  excludeRecordingId: string,
): number {
  const db = getDatabase();
  const row = db
    .execute(
      `SELECT COUNT(*) AS c FROM speaking_recordings
       WHERE file_path = ? AND id != ?;`,
      [filePath, excludeRecordingId],
    )
    .rows?.item(0) as {c?: number} | undefined;
  return Number(row?.c ?? 0);
}

/** Deletes competing takes for the sentence; returns file paths safe to unlink. */
export function deleteOtherSpeakingRecordingsForSentence(
  mode: SpeakingMode,
  sentenceId: string,
  keepId: string,
): string[] {
  const db = getDatabase();
  const result = db.execute(
    `SELECT id, file_path FROM speaking_recordings
     WHERE mode = ? AND sentence_id = ? AND id != ?;`,
    [mode, sentenceId, keepId],
  );
  const paths: string[] = [];
  const rows = result.rows;
  if (rows) {
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows.item(i) as {id: string; file_path: string};
      if (countSpeakingRecordingsWithFilePath(row.file_path, row.id) === 0) {
        paths.push(row.file_path);
      }
      db.execute('DELETE FROM speaking_recordings WHERE id = ?;', [row.id]);
    }
  }
  return paths;
}

export function countSpeakingRecordingsForSentence(
  mode: SpeakingMode,
  sentenceId: string,
): number {
  const db = getDatabase();
  const row = db
    .execute(
      `SELECT COUNT(*) AS c FROM speaking_recordings
       WHERE mode = ? AND sentence_id = ?;`,
      [mode, sentenceId],
    )
    .rows?.item(0) as {c?: number} | undefined;
  return Number(row?.c ?? 0);
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
  // PR 14: spoken task answers (`lesson_task`) are not practice takes.
  const result = lessonId
    ? db.execute(
        "SELECT * FROM speaking_recordings WHERE lesson_id = ? AND mode <> 'lesson_task';",
        [lessonId],
      )
    : db.execute(
        "SELECT * FROM speaking_recordings WHERE mode <> 'lesson_task';",
      );
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
  db.execute('DELETE FROM speaking_attempts;');
  db.execute('DELETE FROM error_events;');
  return {deletedFilePaths};
}
