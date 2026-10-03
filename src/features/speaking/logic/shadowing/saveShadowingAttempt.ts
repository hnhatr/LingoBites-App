import {saveFlashcard} from '@features/review';

import {getDatabase, withTransaction} from '@core/db/database';
import {enqueueSyncOutboxEvent} from '@core/db/syncOutboxCore';
import type {SpeakingRecordingRecordV4} from '@core/db/types';
import {
  buildSpeakingAttemptPayload,
  SPEAKING_ATTEMPTS_EVENT_TYPE,
  speakingAttemptEntityId,
} from '@core/sync/speakingAttempts';

import {
  getSpeakingAttemptForSentence,
  replaceSpeakingAttemptForSentence,
} from '../data/SpeakingAttemptRepository';
import {
  deleteOtherSpeakingRecordingsForSentence,
  findSpeakingRecordingById,
  insertSpeakingRecordingV4,
} from '../data/SpeakingRepository';

const CONSENT_KEY = 'speaking.recording_upload_consent';
const OWNER_KEY = 'current_account_id';

export type ShadowingSentenceContent = {
  textEn: string;
  textVi: string;
  ipa?: string | null;
};

export type SaveShadowingAttemptInput = {
  takeId: string;
  lessonId: string;
  sentenceId: string;
  filePath: string;
  durationMs: number;
  checkFullSentence: boolean;
  checkKeyWords: boolean;
  checkRhythm: boolean;
  sentence: ShadowingSentenceContent;
  practicedAt?: string;
};

export type SaveShadowingAttemptResult =
  | {
      ok: true;
      replay: boolean;
      /** Paths to unlink after the transaction commits (replaced takes). */
      unlinkedFilePaths: string[];
      recording: SpeakingRecordingRecordV4;
      attemptId: string;
    }
  | {ok: false; errorCode: 'LOCAL_DB_ERROR'};

export type SaveShadowingAttemptHooks = {
  afterOutboxInsert?: () => void;
};

function readAppSetting(key: string): string | null {
  const db = getDatabase();
  const row = db
    .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [key])
    .rows?.item(0) as {value?: string} | undefined;
  return row?.value ?? null;
}

function uploadStateForConsent(): 'pending' | 'local_only' {
  return readAppSetting(CONSENT_KEY) === 'on' ? 'pending' : 'local_only';
}

function shadowingAttemptFailed(
  input: Pick<
    SaveShadowingAttemptInput,
    'checkFullSentence' | 'checkKeyWords' | 'checkRhythm'
  >,
): boolean {
  return !(input.checkFullSentence && input.checkKeyWords && input.checkRhythm);
}

/**
 * LING-224 save transaction (FR-010/017/019/028/029): recording replacement,
 * attempt row, outbox mutation, and optional Ôn tập card in one SQLite txn.
 */
export function saveShadowingAttempt(
  input: SaveShadowingAttemptInput,
  hooks: SaveShadowingAttemptHooks = {},
): SaveShadowingAttemptResult {
  try {
    const practicedAt = input.practicedAt ?? new Date().toISOString();
    const mode = 'shadowing' as const;
    return withTransaction(getDatabase(), () => {
      const existing = findSpeakingRecordingById(input.takeId);
      if (existing) {
        const attempt = getSpeakingAttemptForSentence(mode, input.sentenceId);
        return {
          ok: true as const,
          replay: true,
          unlinkedFilePaths: [],
          recording: existing,
          attemptId: attempt?.id ?? input.takeId,
        };
      }

      const ownerUserId = readAppSetting(OWNER_KEY);
      const recording = insertSpeakingRecordingV4({
        id: input.takeId,
        lessonId: input.lessonId,
        sentenceId: input.sentenceId,
        mode,
        filePath: input.filePath,
        durationMs: input.durationMs,
        createdAt: practicedAt,
        ownerUserId,
        uploadState: uploadStateForConsent(),
      });

      const replacedPaths = deleteOtherSpeakingRecordingsForSentence(
        mode,
        input.sentenceId,
        input.takeId,
      );

      const attempt = replaceSpeakingAttemptForSentence({
        id: input.takeId,
        lessonId: input.lessonId,
        sentenceId: input.sentenceId,
        mode,
        practicedAt,
        checkFullSentence: input.checkFullSentence,
        checkKeyWords: input.checkKeyWords,
        checkRhythm: input.checkRhythm,
        durationMs: input.durationMs,
        recordingId: input.takeId,
        updatedAt: practicedAt,
      });

      const entityId = speakingAttemptEntityId(mode, input.sentenceId);
      const payload = buildSpeakingAttemptPayload({
        lessonId: input.lessonId,
        sentenceId: input.sentenceId,
        mode,
        checkFullSentence: input.checkFullSentence,
        checkKeyWords: input.checkKeyWords,
        checkRhythm: input.checkRhythm,
        durationMs: input.durationMs,
        recordingId: input.takeId,
      });

      enqueueSyncOutboxEvent({
        id: input.takeId,
        eventType: SPEAKING_ATTEMPTS_EVENT_TYPE,
        entityId,
        payload,
        createdAt: practicedAt,
      });

      hooks.afterOutboxInsert?.();

      if (shadowingAttemptFailed(input)) {
        const vocabularyId = `shadowing:${input.sentenceId}`;
        const saved = saveFlashcard({
          lessonId: input.lessonId,
          vocabulary: {
            id: vocabularyId,
            word: input.sentence.textEn,
            meaningVi: input.sentence.textVi,
            ipa: input.sentence.ipa ?? null,
          },
          now: practicedAt,
        });
        if (!saved.ok) {
          throw new Error('FLASHCARD_SAVE_FAILED');
        }
      }

      return {
        ok: true as const,
        replay: false,
        unlinkedFilePaths: replacedPaths,
        recording,
        attemptId: attempt.id,
      };
    });
  } catch {
    return {ok: false, errorCode: 'LOCAL_DB_ERROR'};
  }
}
