import {AppState, type AppStateStatus} from 'react-native';

import {getDatabase} from '@core/db/database';
import type {RecordingUploadState, SpeakingMode} from '@core/db/types';
import {isAccountStillOwner} from '@core/sync/syncDrainOwnership';
import {
  deleteTaskAnswer,
  getTaskAnswer,
  markTaskAnswerSent,
} from '@core/sync/taskAnswers';

import {
  createRecordingMetadata,
  RECORDING_UPLOAD_CONSENT_WITHDRAWN,
  RECORDING_UPLOAD_MIME,
  uploadRecordingBinary,
} from '../api/recordingClient';
import type {ReadRecordingFileForUploadResult} from '../recordingService';
import {
  isEvaluationConsentOn,
  isRecordingUploadConsentOn,
} from './recordingConsent';
import {
  processPendingServerRecordingDeletion,
  readPendingServerDeleteMarker,
  setServerRecordingDeletionDrainScheduler,
} from './serverRecordingDeletion';

type ReadRecordingFileForUpload = (
  filePath: string,
) => Promise<ReadRecordingFileForUploadResult>;

async function defaultReadRecordingFile(
  filePath: string,
): Promise<ReadRecordingFileForUploadResult> {
  const {readRecordingFileForUpload} = await import('../recordingService');
  return readRecordingFileForUpload(filePath);
}

const UPLOAD_RETRY_BASE_MS = 5_000;
const UPLOAD_RETRY_MAX_MS = 5 * 60_000;

/** Mirrors `syncRetryDelayMsWithJitter` (sync policy) without a cross-feature import. */
function uploadRetryDelayMsWithJitter(
  attemptCount: number,
  randomFn: () => number = Math.random,
): number {
  const exponent = Math.max(0, attemptCount - 1);
  const raw = UPLOAD_RETRY_BASE_MS * 2 ** exponent;
  const base = Math.min(raw, UPLOAD_RETRY_MAX_MS);
  const jitter = randomFn();
  return Math.floor(base / 2 + (base / 2) * jitter);
}

export type UploadQueueRecordingRow = {
  id: string;
  lessonId: string | null;
  sentenceId: string | null;
  /** PR 14: the attempt a `lesson_task` recording answers. */
  activityId: string | null;
  mode: SpeakingMode | 'lesson_task';
  filePath: string;
  durationMs: number;
  ownerUserId: string | null;
  uploadState: RecordingUploadState;
  uploadAttempts: number;
  uploadNextAt: string | null;
  serverRecordingId: string | null;
};

export type RecordingUploadQueueDeps = {
  now?: () => Date;
  randomFn?: () => number;
  setTimeoutFn?: (
    fn: () => void,
    ms: number,
  ) => ReturnType<typeof setTimeout> | number;
  clearTimeoutFn?: (id: ReturnType<typeof setTimeout> | number) => void;
  createMetadata?: typeof createRecordingMetadata;
  uploadBinary?: typeof uploadRecordingBinary;
  readFile?: ReadRecordingFileForUpload;
  isConsentOn?: typeof isRecordingUploadConsentOn;
  isEvaluationConsentOn?: typeof isEvaluationConsentOn;
  isOwner?: typeof isAccountStillOwner;
  deleteFile?: (filePath: string) => Promise<void>;
};

type PendingJobRow = {
  id: string;
  activity_id: string | null;
  lesson_id: string | null;
  sentence_id: string | null;
  mode: string;
  file_path: string;
  duration_ms: number;
  owner_user_id: string | null;
  upload_state: string;
  upload_attempts: number;
  upload_next_at: string | null;
  server_recording_id: string | null;
};

let deps: RecordingUploadQueueDeps = {};
let drainChain: Promise<void> = Promise.resolve();
let retryTimer: ReturnType<typeof setTimeout> | number | null = null;
let initialized = false;
let appStateSubscription: {remove: () => void} | null = null;

export function configureRecordingUploadQueue(
  overrides: RecordingUploadQueueDeps,
): void {
  deps = {...deps, ...overrides};
}

export function resetRecordingUploadQueueForTests(): void {
  deps = {};
  drainChain = Promise.resolve();
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
  initialized = false;
  setServerRecordingDeletionDrainScheduler(() => {
    requestRecordingUploadDrain();
  });
}

function nowIso(): string {
  return (deps.now ?? (() => new Date()))().toISOString();
}

function mapRow(row: PendingJobRow): UploadQueueRecordingRow {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    sentenceId: row.sentence_id,
    activityId: row.activity_id,
    mode: row.mode as UploadQueueRecordingRow['mode'],
    filePath: row.file_path,
    durationMs: row.duration_ms,
    ownerUserId: row.owner_user_id,
    uploadState: row.upload_state as RecordingUploadState,
    uploadAttempts: row.upload_attempts ?? 0,
    uploadNextAt: row.upload_next_at,
    serverRecordingId: row.server_recording_id,
  };
}

function readRow(id: string): UploadQueueRecordingRow | null {
  const db = getDatabase();
  const row = db
    .execute('SELECT * FROM speaking_recordings WHERE id = ? LIMIT 1;', [id])
    .rows?.item(0) as PendingJobRow | undefined;
  return row ? mapRow(row) : null;
}

function hasPendingServerDeleteMarker(): boolean {
  return readPendingServerDeleteMarker() !== null;
}

function listDuePendingRecordingIds(at: string): string[] {
  const db = getDatabase();
  const result = db.execute(
    `SELECT id FROM speaking_recordings
     WHERE upload_state = 'pending'
       AND (upload_next_at IS NULL OR upload_next_at <= ?)
     ORDER BY created_at ASC;`,
    [at],
  );
  const ids: string[] = [];
  const rows = result.rows;
  if (!rows) return ids;
  for (let i = 0; i < rows.length; i += 1) {
    ids.push((rows.item(i) as {id: string}).id);
  }
  return ids;
}

function flipPendingToLocalOnly(id: string): void {
  const db = getDatabase();
  db.execute(
    `UPDATE speaking_recordings
     SET upload_state = 'local_only',
         upload_next_at = NULL,
         upload_error = NULL,
         server_recording_id = NULL
     WHERE id = ? AND upload_state = 'pending';`,
    [id],
  );
}

function scheduleRetry(
  id: string,
  attempts: number,
  errorCode: string,
  delayMs: number,
): void {
  const db = getDatabase();
  const nextAt = new Date(
    (deps.now ?? (() => new Date()))().getTime() + delayMs,
  ).toISOString();
  db.execute(
    `UPDATE speaking_recordings
     SET upload_attempts = ?,
         upload_next_at = ?,
         upload_error = ?
     WHERE id = ? AND upload_state = 'pending';`,
    [attempts, nextAt, errorCode, id],
  );
}

function markUploaded(id: string, serverRecordingId: string | null): void {
  const db = getDatabase();
  db.execute(
    `UPDATE speaking_recordings
     SET upload_state = 'uploaded',
         upload_next_at = NULL,
         upload_error = NULL,
         server_recording_id = COALESCE(?, server_recording_id)
     WHERE id = ? AND upload_state = 'pending';`,
    [serverRecordingId, id],
  );
}

function markFailed(id: string, errorCode: string): void {
  const db = getDatabase();
  db.execute(
    `UPDATE speaking_recordings
     SET upload_state = 'failed',
         upload_next_at = NULL,
         upload_error = ?
     WHERE id = ? AND upload_state = 'pending';`,
    [errorCode, id],
  );
}

const PERMANENT_FILE_READ_ERROR_CODES = new Set(['NOT_FOUND']);

function handleUploadClientFailure(
  id: string,
  errorCode: string,
  retryable: boolean,
  attempts: number,
): void {
  if (errorCode === RECORDING_UPLOAD_CONSENT_WITHDRAWN) {
    const row = readRow(id);
    if (row?.mode === 'lesson_task') discardLessonTask(row);
    else flipPendingToLocalOnly(id);
    return;
  }
  if (!retryable) {
    markFailed(id, errorCode);
    return;
  }
  const delayMs = uploadRetryDelayMsWithJitter(
    attempts,
    deps.randomFn ?? Math.random,
  );
  scheduleRetry(id, attempts, errorCode, delayMs);
  armRetryTimer(delayMs);
}

async function defaultDeleteFile(filePath: string): Promise<void> {
  const {deleteRecordingFile} = await import('../recordingService');
  await deleteRecordingFile(filePath);
}

function consentOnFor(row: UploadQueueRecordingRow): boolean {
  return row.mode === 'lesson_task'
    ? (deps.isEvaluationConsentOn ?? isEvaluationConsentOn)()
    : (deps.isConsentOn ?? isRecordingUploadConsentOn)();
}

/**
 * PR 14 (decision H6): without the grading consent a spoken task answer is
 * never sent; its file, its queue row and its pending answer go (the
 * attempt falls back to "not graded", decision H10).
 */
function discardLessonTask(row: UploadQueueRecordingRow): void {
  getDatabase().execute('DELETE FROM speaking_recordings WHERE id = ?;', [
    row.id,
  ]);
  if (row.activityId) deleteTaskAnswer(row.activityId);
  (deps.deleteFile ?? defaultDeleteFile)(row.filePath).catch(() => undefined);
}

function consentAllowsUpload(row: UploadQueueRecordingRow): boolean {
  if (!consentOnFor(row)) {
    if (row.mode === 'lesson_task') discardLessonTask(row);
    else flipPendingToLocalOnly(row.id);
    return false;
  }
  return true;
}

type CreateRequest = Parameters<typeof createRecordingMetadata>[0];

/** The create request of a queued row, or null when it cannot be built. */
function createRequestFor(
  row: UploadQueueRecordingRow,
  file: {byteSize: number; sha256: string},
): CreateRequest | null {
  if (row.mode !== 'lesson_task') {
    if (!row.lessonId || !row.sentenceId) return null;
    return {
      mime_type: RECORDING_UPLOAD_MIME,
      byte_size: file.byteSize,
      sha256: file.sha256,
      client_recording_id: row.id,
      lesson_id: row.lessonId,
      sentence_id: row.sentenceId,
      mode: row.mode,
      duration_ms: row.durationMs,
    };
  }
  const answer = row.activityId ? getTaskAnswer(row.activityId) : null;
  if (!answer?.target) return null;
  return {
    client_recording_id: row.id,
    mode: 'lesson_task',
    attempt_id: answer.attemptId,
    target: answer.target,
    support_level: answer.supportLevel,
    duration_ms: Math.max(1, Math.round(row.durationMs)),
    mime_type: RECORDING_UPLOAD_MIME,
    byte_size: file.byteSize,
    sha256: file.sha256,
  };
}

function armRetryTimer(delayMs: number): void {
  const setTimeoutFn = deps.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = deps.clearTimeoutFn ?? clearTimeout;
  if (retryTimer !== null) {
    clearTimeoutFn(retryTimer);
  }
  retryTimer = setTimeoutFn(() => {
    retryTimer = null;
    requestRecordingUploadDrain();
  }, delayMs);
}

async function processRecordingJob(id: string): Promise<void> {
  const row = readRow(id);
  if (!row || row.uploadState !== 'pending') {
    return;
  }

  if (!consentAllowsUpload(row)) {
    return;
  }

  if (!row.ownerUserId) {
    return;
  }

  const ownerOk = await (deps.isOwner ?? isAccountStillOwner)(row.ownerUserId);
  if (!ownerOk) {
    return;
  }

  if (hasPendingServerDeleteMarker()) {
    return;
  }

  const refreshed = readRow(id);
  if (!refreshed || refreshed.uploadState !== 'pending') {
    return;
  }

  const fileResult = await (deps.readFile ?? defaultReadRecordingFile)(
    refreshed.filePath,
  );
  if (!fileResult.ok) {
    if (PERMANENT_FILE_READ_ERROR_CODES.has(fileResult.errorCode)) {
      markFailed(id, fileResult.errorCode);
      return;
    }
    const attempts = refreshed.uploadAttempts + 1;
    const delayMs = uploadRetryDelayMsWithJitter(
      attempts,
      deps.randomFn ?? Math.random,
    );
    scheduleRetry(id, attempts, fileResult.errorCode, delayMs);
    armRetryTimer(delayMs);
    return;
  }

  if (!consentAllowsUpload(refreshed)) {
    return;
  }

  const request = createRequestFor(refreshed, fileResult);
  if (!request) {
    markFailed(id, 'INVALID_RECORDING_ROW');
    return;
  }
  // Speaking takes keep their call unchanged; task answers are gated on the
  // grading consent (PR 14).
  const clientOptions =
    refreshed.mode === 'lesson_task'
      ? {expectedUserId: refreshed.ownerUserId!, consent: 'evaluation' as const}
      : {expectedUserId: refreshed.ownerUserId!};
  const createResult = await (deps.createMetadata ?? createRecordingMetadata)(
    request,
    clientOptions,
  );

  if (!createResult.ok) {
    handleUploadClientFailure(
      id,
      createResult.errorCode,
      createResult.retryable,
      refreshed.uploadAttempts + 1,
    );
    return;
  }

  const serverId =
    createResult.data.recording?.recording_id ??
    refreshed.serverRecordingId ??
    null;

  if (!consentAllowsUpload(refreshed)) {
    return;
  }

  const uploadResult = await (deps.uploadBinary ?? uploadRecordingBinary)(
    createResult.data.upload.url,
    createResult.data.upload.content_type || RECORDING_UPLOAD_MIME,
    fileResult.binary,
    clientOptions,
  );

  if (!uploadResult.ok) {
    handleUploadClientFailure(
      id,
      uploadResult.errorCode,
      uploadResult.retryable,
      refreshed.uploadAttempts + 1,
    );
    return;
  }

  markUploaded(id, serverId);
  if (refreshed.mode === 'lesson_task' && refreshed.activityId) {
    // Decision H2: the Server keeps the answer 30 days; the device does not.
    markTaskAnswerSent(refreshed.activityId);
    await (deps.deleteFile ?? defaultDeleteFile)(refreshed.filePath).catch(
      () => undefined,
    );
  }
}

async function runDrainOnce(): Promise<void> {
  await processPendingServerRecordingDeletion();
  const at = nowIso();
  const ids = listDuePendingRecordingIds(at);
  for (const id of ids) {
    await processRecordingJob(id);
  }
}

export function requestRecordingUploadDrain(): void {
  drainChain = drainChain.then(runDrainOnce).catch(() => {});
}

export function initRecordingUploadQueue(): void {
  if (initialized) {
    requestRecordingUploadDrain();
    return;
  }
  initialized = true;
  requestRecordingUploadDrain();
  appStateSubscription = AppState.addEventListener(
    'change',
    (state: AppStateStatus) => {
      if (state === 'active') {
        requestRecordingUploadDrain();
      }
    },
  );
}

export async function flushRecordingUploadQueueForTests(): Promise<void> {
  await drainChain;
}

setServerRecordingDeletionDrainScheduler(() => {
  requestRecordingUploadDrain();
});
