import {getDatabase} from '@core/db/database';
import type {SpeakingAttemptRecord, SpeakingMode} from '@core/db/types';

type SpeakingAttemptRow = {
  id: string;
  lesson_id: string;
  sentence_id: string;
  mode: string;
  practiced_at: string;
  check_full_sentence: number;
  check_key_words: number;
  check_rhythm: number;
  duration_ms: number;
  recording_id: string | null;
  revision: number;
  updated_at: string;
};

function mapRow(row: SpeakingAttemptRow): SpeakingAttemptRecord {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    sentenceId: row.sentence_id,
    mode: row.mode as SpeakingMode,
    practicedAt: row.practiced_at,
    checkFullSentence: Boolean(row.check_full_sentence),
    checkKeyWords: Boolean(row.check_key_words),
    checkRhythm: Boolean(row.check_rhythm),
    durationMs: row.duration_ms,
    recordingId: row.recording_id,
    revision: row.revision ?? 0,
    updatedAt: row.updated_at,
  };
}

export function getSpeakingAttemptById(
  id: string,
): SpeakingAttemptRecord | null {
  const db = getDatabase();
  const row = db
    .execute('SELECT * FROM speaking_attempts WHERE id = ? LIMIT 1;', [id])
    .rows?.item(0) as SpeakingAttemptRow | undefined;
  return row ? mapRow(row) : null;
}

export function getSpeakingAttemptForSentence(
  mode: SpeakingMode,
  sentenceId: string,
): SpeakingAttemptRecord | null {
  const db = getDatabase();
  const row = db
    .execute(
      `SELECT * FROM speaking_attempts
       WHERE mode = ? AND sentence_id = ? LIMIT 1;`,
      [mode, sentenceId],
    )
    .rows?.item(0) as SpeakingAttemptRow | undefined;
  return row ? mapRow(row) : null;
}

export function countSpeakingAttempts(): number {
  const db = getDatabase();
  const row = db
    .execute('SELECT COUNT(*) AS c FROM speaking_attempts;')
    .rows?.item(0) as {c?: number} | undefined;
  return Number(row?.c ?? 0);
}

export type UpsertSpeakingAttemptInput = {
  id: string;
  lessonId: string;
  sentenceId: string;
  mode: SpeakingMode;
  practicedAt: string;
  checkFullSentence: boolean;
  checkKeyWords: boolean;
  checkRhythm: boolean;
  durationMs: number;
  recordingId: string;
  updatedAt?: string;
};

/** One row per (mode, sentence_id): replace any previous attempt for the key. */
export function replaceSpeakingAttemptForSentence(
  input: UpsertSpeakingAttemptInput,
): SpeakingAttemptRecord {
  const db = getDatabase();
  const updatedAt = input.updatedAt ?? input.practicedAt;
  db.execute(
    'DELETE FROM speaking_attempts WHERE mode = ? AND sentence_id = ?;',
    [input.mode, input.sentenceId],
  );
  db.execute(
    `INSERT INTO speaking_attempts (
      id, lesson_id, sentence_id, mode, practiced_at,
      check_full_sentence, check_key_words, check_rhythm,
      duration_ms, recording_id, revision, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?);`,
    [
      input.id,
      input.lessonId,
      input.sentenceId,
      input.mode,
      input.practicedAt,
      input.checkFullSentence ? 1 : 0,
      input.checkKeyWords ? 1 : 0,
      input.checkRhythm ? 1 : 0,
      input.durationMs,
      input.recordingId,
      updatedAt,
    ],
  );
  return getSpeakingAttemptForSentence(input.mode, input.sentenceId)!;
}
