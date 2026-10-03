import type {QuickSQLiteConnection} from 'react-native-quick-sqlite';

import {getDatabase} from '@core/db/database';
import type {SpeakingMode} from '@core/db/types';
import {
  type SpeakingAttemptPayload,
  SpeakingAttemptPayloadSchema,
  type SyncPullRecord,
  type SyncRecord,
} from '@core/schemas/sync';

/** Outbox event type and sync collection name (LING-224 AD-004). */
export const SPEAKING_ATTEMPTS_EVENT_TYPE = 'speaking_attempts' as const;

/** Fixed payload keys enforced by INV-006 / contract r1. */
export const SPEAKING_ATTEMPT_PAYLOAD_KEYS = [
  'lesson_id',
  'sentence_id',
  'mode',
  'check_full_sentence',
  'check_key_words',
  'check_rhythm',
  'duration_ms',
  'recording_id',
] as const satisfies readonly (keyof SpeakingAttemptPayload)[];

export type BuildSpeakingAttemptPayloadInput = {
  lessonId: string;
  sentenceId: string;
  mode: SpeakingMode;
  checkFullSentence: boolean;
  checkKeyWords: boolean;
  checkRhythm: boolean;
  durationMs: number;
  recordingId: string | null;
};

/**
 * INV-006: the only supported way to build a push/pull speaking_attempts payload.
 */
export function buildSpeakingAttemptPayload(
  input: BuildSpeakingAttemptPayloadInput,
): SpeakingAttemptPayload {
  return SpeakingAttemptPayloadSchema.parse({
    lesson_id: input.lessonId,
    sentence_id: input.sentenceId,
    mode: input.mode,
    check_full_sentence: input.checkFullSentence,
    check_key_words: input.checkKeyWords,
    check_rhythm: input.checkRhythm,
    duration_ms: input.durationMs,
    recording_id: input.recordingId,
  });
}

export function speakingAttemptEntityId(
  mode: SpeakingMode,
  sentenceId: string,
): string {
  return `${mode}:${sentenceId}`;
}

export function parseSpeakingAttemptEntityId(entityId: string): {
  mode: SpeakingMode;
  sentenceId: string;
} {
  const separator = entityId.indexOf(':');
  if (separator <= 0 || separator >= entityId.length - 1) {
    throw new Error(`Invalid speaking_attempts entity_id: ${entityId}`);
  }
  return {
    mode: entityId.slice(0, separator) as SpeakingMode,
    sentenceId: entityId.slice(separator + 1),
  };
}

function readLocalPracticedAt(
  db: QuickSQLiteConnection,
  mode: SpeakingMode,
  sentenceId: string,
): string | null {
  const row = db
    .execute(
      `SELECT practiced_at FROM speaking_attempts
       WHERE mode = ? AND sentence_id = ? LIMIT 1;`,
      [mode, sentenceId],
    )
    .rows?.item(0) as {practiced_at?: string} | undefined;
  return row?.practiced_at ?? null;
}

function readPendingOutboxOccurredAt(
  db: QuickSQLiteConnection,
  entityId: string,
): string | null {
  const row = db
    .execute(
      `SELECT created_at FROM sync_outbox
       WHERE entity_id = ? AND event_type = ? AND synced_at IS NULL
       ORDER BY datetime(created_at) DESC LIMIT 1;`,
      [entityId, SPEAKING_ATTEMPTS_EVENT_TYPE],
    )
    .rows?.item(0) as {created_at?: string} | undefined;
  return row?.created_at ?? null;
}

/** Local LWW key: row `practiced_at` or newest unsynced outbox time (AD-004). */
export function getLocalSpeakingAttemptWriteTime(
  entityId: string,
): string | null {
  const db = getDatabase();
  const {mode, sentenceId} = parseSpeakingAttemptEntityId(entityId);
  const practicedAt = readLocalPracticedAt(db, mode, sentenceId);
  const pendingOutboxAt = readPendingOutboxOccurredAt(db, entityId);
  if (practicedAt && pendingOutboxAt) {
    return Date.parse(practicedAt) >= Date.parse(pendingOutboxAt)
      ? practicedAt
      : pendingOutboxAt;
  }
  return practicedAt ?? pendingOutboxAt;
}

export function shouldApplyRemoteSpeakingAttempt(
  localWriteTime: string | null,
  remoteOccurredAt: string,
): boolean {
  if (!localWriteTime) {
    return true;
  }
  return Date.parse(remoteOccurredAt) >= Date.parse(localWriteTime);
}

function deleteSpeakingRowsForSentence(
  db: QuickSQLiteConnection,
  mode: SpeakingMode,
  sentenceId: string,
): string[] {
  const paths: string[] = [];
  const recordings = db.execute(
    `SELECT file_path FROM speaking_recordings
     WHERE mode = ? AND sentence_id = ?;`,
    [mode, sentenceId],
  ).rows;
  if (recordings) {
    for (let i = 0; i < recordings.length; i += 1) {
      paths.push((recordings.item(i) as {file_path: string}).file_path);
    }
  }
  db.execute(
    'DELETE FROM speaking_recordings WHERE mode = ? AND sentence_id = ?;',
    [mode, sentenceId],
  );
  db.execute(
    'DELETE FROM speaking_attempts WHERE mode = ? AND sentence_id = ?;',
    [mode, sentenceId],
  );
  return paths;
}

function upsertSpeakingAttemptFromPull(
  db: QuickSQLiteConnection,
  entityId: string,
  payload: SpeakingAttemptPayload,
  revision: number,
  updatedAt: string,
  practicedAt: string,
): void {
  const {mode, sentenceId} = parseSpeakingAttemptEntityId(entityId);
  db.execute(
    'DELETE FROM speaking_attempts WHERE mode = ? AND sentence_id = ?;',
    [mode, sentenceId],
  );
  const attemptId = payload.recording_id ?? entityId;
  db.execute(
    `INSERT INTO speaking_attempts (
      id, lesson_id, sentence_id, mode, practiced_at,
      check_full_sentence, check_key_words, check_rhythm,
      duration_ms, recording_id, revision, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      attemptId,
      payload.lesson_id,
      payload.sentence_id,
      payload.mode,
      practicedAt,
      payload.check_full_sentence ? 1 : 0,
      payload.check_key_words ? 1 : 0,
      payload.check_rhythm ? 1 : 0,
      payload.duration_ms,
      payload.recording_id,
      revision,
      updatedAt,
    ],
  );
}

/**
 * Applies one `speaking_attempts` pull record (AD-004 / INV-005).
 * Collects recording file paths to unlink after the pull transaction commits.
 */
export function applySpeakingAttemptRecord(
  record: SyncRecord | SyncPullRecord,
  pendingUnlinks?: string[],
): boolean {
  if (record.collection !== SPEAKING_ATTEMPTS_EVENT_TYPE) {
    return false;
  }
  const db = getDatabase();
  const {mode, sentenceId} = parseSpeakingAttemptEntityId(record.entity_id);
  if (record.tombstone) {
    const paths = deleteSpeakingRowsForSentence(db, mode, sentenceId);
    pendingUnlinks?.push(...paths);
    return true;
  }

  const parsed = SpeakingAttemptPayloadSchema.safeParse(record.payload);
  if (!parsed.success) {
    throw new Error(
      `Invalid speaking_attempts payload for ${record.entity_id}`,
    );
  }
  if (parsed.data.sentence_id !== sentenceId || parsed.data.mode !== mode) {
    throw new Error(
      `speaking_attempts entity/payload mismatch for ${record.entity_id}`,
    );
  }

  const localWriteTime = getLocalSpeakingAttemptWriteTime(record.entity_id);
  if (!shouldApplyRemoteSpeakingAttempt(localWriteTime, record.occurred_at)) {
    return true;
  }

  upsertSpeakingAttemptFromPull(
    db,
    record.entity_id,
    parsed.data,
    record.revision,
    record.updated_at,
    record.occurred_at,
  );
  return true;
}
