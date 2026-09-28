/**
 * Automatic Error Notebook capture (SETE-110 / M5, REQ-28/29, VC-18).
 *
 * Classifies a failed/weak attempt outcome — from either the lesson runtime
 * or the Speaking Room self-check — into one of the six required categories
 * and writes it via `SpeakingRepository.captureErrorEvent`, which also
 * creates the linked review item. There is no manual "add flashcard" step
 * anywhere in this module; capture only ever happens as a side effect of a
 * qualifying attempt outcome the caller already computed.
 */

import {captureErrorEvent} from './data/SpeakingRepository';
import type {
  ErrorEventCategory,
  ErrorEventRecord,
  ErrorEventSource,
} from '@shared/db/types';

const SLOW_RESPONSE_MS = 8000;

/**
 * Self-check / attempt signals a caller can observe without ever recording
 * the raw sentence spoken/typed (CON-6). `taskCompleted`/`keyPhraseUsed` come
 * from the Speaking Room checklist; `listeningMiss`/`hintsUsed` come from the
 * lesson runtime's existing attempt tracking.
 */
export type SpeakingAttemptOutcome = {
  taskCompleted: boolean;
  keyPhraseUsed: boolean;
  responseTimeMs?: number;
  listeningMiss?: boolean;
  contextMismatch?: boolean;
  pronunciationAffectsMeaning?: boolean;
};

/**
 * Picks the single most relevant error category for a weak/failed attempt.
 * Order matters: a mismatch/listening/pronunciation signal is more specific
 * than a generic "task not completed", which is more specific than slowness.
 */
export function classifySpeakingAttempt(
  outcome: SpeakingAttemptOutcome,
): ErrorEventCategory | null {
  if (outcome.listeningMiss) {
    return 'listening';
  }
  if (outcome.pronunciationAffectsMeaning) {
    return 'pronunciation_affecting_meaning';
  }
  if (outcome.contextMismatch) {
    return 'context_mismatch';
  }
  if (!outcome.keyPhraseUsed) {
    return 'vocabulary';
  }
  if (!outcome.taskCompleted) {
    return 'structure';
  }
  if ((outcome.responseTimeMs ?? 0) > SLOW_RESPONSE_MS) {
    return 'slow_response';
  }
  return null;
}

export type CaptureSpeakingErrorInput = {
  id: string;
  source: ErrorEventSource;
  activityId?: string | null;
  lessonId?: string | null;
  outcome: SpeakingAttemptOutcome;
};

/**
 * Classifies the outcome and, if it qualifies as a weak/failed attempt,
 * automatically captures an `error_events` row + linked review item.
 * Returns `null` when the attempt was strong enough that no error applies.
 */
export function captureSpeakingErrorIfNeeded(
  input: CaptureSpeakingErrorInput,
): ErrorEventRecord | null {
  const category = classifySpeakingAttempt(input.outcome);
  if (!category) {
    return null;
  }
  const {errorEvent} = captureErrorEvent({
    id: input.id,
    source: input.source,
    category,
    activityId: input.activityId,
    lessonId: input.lessonId,
  });
  return errorEvent;
}
