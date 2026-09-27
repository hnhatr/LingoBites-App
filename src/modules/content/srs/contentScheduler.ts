/**
 * Generalized SRS scheduler for `content_review_items` (SETE-109 / M4).
 *
 * Generalizes the fixed-interval, two-rating model of the legacy flashcard
 * scheduler (`shared/db/reviewScheduler.ts`, SETE-92) to every M1-declared
 * `SrsItemType` (vocabulary, grammar, dialogue_turn, qa — see
 * `modules/content/schema`), adds the five-state mastery lifecycle (REQ-25),
 * and factors in hints-used / response-time signals when present (REQ-27).
 *
 * REQ-26 is explicit that the MVP scheduler is fixed transparent intervals,
 * not SM-2/FSRS — do not add adaptive-difficulty math here.
 *
 * The item type is accepted on the input for callers/telemetry only; per
 * REQ-24/VC-5 the scheduling math below never branches on it.
 */

import type {ContentMasteryState} from '@shared/content/contracts';

export type {ContentMasteryState};

const VALID_STATES: ReadonlySet<ContentMasteryState> = new Set([
  'new',
  'learning',
  'reviewing',
  'mastered',
  'relearning',
]);

const MINUTES_PER_DAY = 24 * 60;

/** Fixed MVP interval chain (REQ-26): first step in minutes, rest in days. */
export const CONTENT_INTERVAL_MINUTES = [
  10,
  1 * MINUTES_PER_DAY,
  3 * MINUTES_PER_DAY,
  7 * MINUTES_PER_DAY,
  14 * MINUTES_PER_DAY,
  30 * MINUTES_PER_DAY,
  60 * MINUTES_PER_DAY,
  120 * MINUTES_PER_DAY,
];

/** Steps at or below this index are still the initial learning ramp. */
const LEARNING_CEILING_INDEX = 1; // 10 minutes, 1 day
const MASTERED_INDEX = CONTENT_INTERVAL_MINUTES.length - 1; // 120 days

/** A correct answer this slow is treated the same as one that needed a hint. */
const SLOW_RESPONSE_MS = 8000;

export type ContentReviewOutcome = {
  /** Whether the learner recalled the item correctly on this review. */
  correct: boolean;
  /** Hints revealed before answering, when the activity captures that signal. */
  hintsUsed?: number;
  /** Time taken to answer in milliseconds, when the activity captures it. */
  responseTimeMs?: number;
};

export type ContentScheduleInput = {
  /** `SrsItemType` value — carried through for callers, never branched on. */
  itemType: string;
  currentState: ContentMasteryState;
  /**
   * Minutes of the interval the item was last scheduled on. Omit for a row
   * that has never had a real review recorded (`currentState === 'new'`).
   */
  currentIntervalMinutes?: number;
  outcome: ContentReviewOutcome;
  reviewedAt?: string;
};

export type ContentScheduleResult = {
  state: ContentMasteryState;
  intervalMinutes: number;
  nextReviewAt: string;
};

function addMinutesIso(iso: string, minutes: number): string {
  const date = new Date(iso);
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return date.toISOString();
}

/** Index of the chain entry closest to a previously-used interval. */
function closestIntervalIndex(minutes: number): number {
  let closest = 0;
  let closestDiff = Infinity;
  CONTENT_INTERVAL_MINUTES.forEach((candidate, index) => {
    const diff = Math.abs(candidate - minutes);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = index;
    }
  });
  return closest;
}

/** A correct answer that needed hints or came in slow doesn't earn a full step up. */
function isWeakCorrect(outcome: ContentReviewOutcome): boolean {
  const hinted = (outcome.hintsUsed ?? 0) > 0;
  const slow = (outcome.responseTimeMs ?? 0) > SLOW_RESPONSE_MS;
  return hinted || slow;
}

function stateForIndex(index: number): ContentMasteryState {
  if (index >= MASTERED_INDEX) {
    return 'mastered';
  }
  if (index <= LEARNING_CEILING_INDEX) {
    return 'learning';
  }
  return 'reviewing';
}

/**
 * Computes the next mastery state + interval for one `content_review_items`
 * review, uniformly across every SRS item type.
 */
export function calculateNextContentReviewState({
  currentState,
  currentIntervalMinutes,
  outcome,
  reviewedAt = new Date().toISOString(),
}: ContentScheduleInput): ContentScheduleResult {
  if (!VALID_STATES.has(currentState)) {
    throw new Error(`Unknown content review mastery state: "${currentState}"`);
  }

  const currentIndex =
    currentState === 'new' || currentIntervalMinutes === undefined
      ? -1
      : closestIntervalIndex(currentIntervalMinutes);

  let nextIndex: number;
  let state: ContentMasteryState;

  if (!outcome.correct) {
    nextIndex = 0;
    state = 'relearning';
  } else {
    nextIndex = isWeakCorrect(outcome)
      ? Math.max(currentIndex, 0)
      : Math.min(currentIndex + 1, MASTERED_INDEX);
    state = stateForIndex(nextIndex);
  }

  const intervalMinutes = CONTENT_INTERVAL_MINUTES[nextIndex];
  return {
    state,
    intervalMinutes,
    nextReviewAt: addMinutesIso(reviewedAt, intervalMinutes),
  };
}

export type SelectDueContentReviewItemsOptions = {
  now?: string;
  limit?: number;
};

/** Generalizes `selectDueReviewCards` for the `content_review_items` shape. */
export function selectDueContentReviewItems<T extends {nextReviewAt: string}>(
  items: T[],
  {
    now = new Date().toISOString(),
    limit,
  }: SelectDueContentReviewItemsOptions = {},
): T[] {
  const dueBy = new Date(now).getTime();
  const due = items
    .filter(item => new Date(item.nextReviewAt).getTime() <= dueBy)
    .sort((a, b) => a.nextReviewAt.localeCompare(b.nextReviewAt));

  if (!limit || limit <= 0) {
    return due;
  }
  return due.slice(0, limit);
}
