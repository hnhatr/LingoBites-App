import {normalizeAnswer} from '@core/learning';
import type {
  LessonComposeProgress,
  LessonCreationError,
  LessonSnapshot,
} from '@core/schemas/lesson';

import {isFlowLesson} from '../../flow/logic/practiceCompletion';
import {COMPOSE_PICK_MAX, COMPOSE_PICK_MIN} from './composeClient';

/**
 * S4.3 J8: the same "can these sentences make a lesson" rules as the Server
 * precheck (S4.1 §3.1), run on the App so the button is off before anything
 * is sent. The Server always checks again.
 */
export const COMPOSE_SENTENCE_CHARS_MAX = 300;
export const COMPOSE_MIN_TOTAL_WORDS = 8;
/** J8: picks further apart than this get a soft "pick neighbours" hint. */
export const COMPOSE_FAR_APART = 3;

export type ComposePickIssue = 'too_few' | 'too_long' | 'too_thin' | null;

const words = (text: string) =>
  text.split(/\s+/).filter(word => /\p{L}/u.test(word));

export function composePickIssue(texts: readonly string[]): ComposePickIssue {
  if (texts.length < COMPOSE_PICK_MIN) return 'too_few';
  if (texts.some(text => text.length > COMPOSE_SENTENCE_CHARS_MAX)) {
    return 'too_long';
  }
  if (texts.some(text => !/[A-Za-z]/.test(text))) return 'too_thin';
  const total = texts.reduce((sum, text) => sum + words(text).length, 0);
  if (total < COMPOSE_MIN_TOTAL_WORDS) return 'too_thin';
  const cries = texts.filter(text => words(text).length <= 2).length;
  if (cries * 2 > texts.length) return 'too_thin';
  const distinct = new Set(texts.map(text => normalizeAnswer(text)));
  if (distinct.size < COMPOSE_PICK_MIN) return 'too_thin';
  return null;
}

/** Positions of the picks are more than `COMPOSE_FAR_APART` apart. */
export function picksFarApart(positions: readonly number[]): boolean {
  const sorted = [...positions].sort((a, b) => a - b);
  return sorted.some(
    (position, index) =>
      index > 0 && position - sorted[index - 1]! > COMPOSE_FAR_APART,
  );
}

/** Toggle one sentence, never past the maximum. */
export function togglePick(
  picked: readonly string[],
  sentenceId: string,
): string[] {
  if (picked.includes(sentenceId)) {
    return picked.filter(id => id !== sentenceId);
  }
  return picked.length >= COMPOSE_PICK_MAX
    ? [...picked]
    : [...picked, sentenceId];
}

/**
 * J1: the learner may compose from their own lesson or a published
 * curriculum lesson, as long as it is not already a six-step lesson and has
 * at least two sentences.
 */
export function canComposeFrom(snapshot: LessonSnapshot): boolean {
  return (
    !snapshot.generated &&
    !isFlowLesson(snapshot) &&
    snapshot.sentences.length >= COMPOSE_PICK_MIN
  );
}

export type ComposeFailureCopy = {
  /** i18n key and values of the main message. */
  messageKey: string;
  values?: Record<string, unknown>;
  /** Reason and suggestion the AI wrote (not suitable). */
  reasonVi?: string | null;
  suggestionVi?: string | null;
  /** i18n key of "charged / not charged", from the Server's flag. */
  chargedKey: string | null;
  retry: boolean;
  repick: boolean;
};

/**
 * Wait design §3.3: what the learner reads for each failure. Whether the
 * try was charged always comes from the Server (`quota_charged`).
 */
export function composeFailureCopy(
  error: LessonCreationError,
  progress: LessonComposeProgress | null,
): ComposeFailureCopy {
  const chargedKey = progress
    ? progress.quota_charged
      ? 'compose.charged'
      : 'compose.not_charged'
    : null;
  switch (error.code) {
    case 'COMPOSE_NOT_SUITABLE':
      return {
        messageKey: 'compose.not_suitable_default',
        reasonVi: progress?.reason_vi ?? null,
        suggestionVi: progress?.suggestion_vi ?? null,
        chargedKey,
        retry: false,
        repick: true,
      };
    case 'COMPOSE_AI_INVALID':
    case 'COMPOSE_SPEC_INVALID':
      return {
        messageKey: 'compose.error_invalid',
        chargedKey,
        retry: true,
        repick: true,
      };
    case 'COMPOSE_TIMEOUT':
    case 'COMPOSE_PROVIDER_FAILED':
      return {
        messageKey: 'compose.error_timeout',
        chargedKey,
        retry: true,
        repick: false,
      };
    case 'COMPOSE_BUDGET_EXHAUSTED':
      return {
        messageKey: 'compose.error_budget',
        chargedKey,
        retry: false,
        repick: false,
      };
    case 'COMPOSE_SOURCE_GONE':
      return {
        messageKey: 'compose.error_source_gone',
        chargedKey,
        retry: false,
        repick: true,
      };
    default:
      return {
        messageKey: 'compose.error_generic',
        chargedKey,
        retry: error.retryable,
        repick: false,
      };
  }
}

/** Refusals the Server answers before any AI call (never charged). */
export function composeRefusalKey(code: string): string {
  switch (code) {
    case 'COMPOSE_LIMIT_REACHED':
      return 'compose.error_limit';
    case 'COMPOSE_BUDGET_EXHAUSTED':
      return 'compose.error_budget';
    case 'COMPOSE_DISABLED':
      return 'compose.error_disabled';
    case 'COMPOSE_SENTENCES_TOO_THIN':
      return 'compose.too_thin';
    case 'COMPOSE_SENTENCE_TOO_LONG':
      return 'compose.error_too_long';
    case 'COMPOSE_ALREADY_SIX_STEP':
    case 'COMPOSE_ALREADY_DERIVED':
      return 'compose.error_already_six_step';
    default:
      return 'compose.error_generic';
  }
}

/** Progress stages in order (Server wait design §2.3). */
export const COMPOSE_STAGES = [
  'queued',
  'preparing',
  'writing',
  'retrying',
  'building',
  'saving',
] as const;

export function composeStageIndex(stage: string | null | undefined): number {
  const index = COMPOSE_STAGES.indexOf(
    (stage ?? 'queued') as (typeof COMPOSE_STAGES)[number],
  );
  return index < 0 ? 0 : index;
}
