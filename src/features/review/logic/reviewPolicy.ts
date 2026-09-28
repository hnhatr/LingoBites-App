import type {ReviewRating} from '@shared/db/types';

export const DEFAULT_REVIEW_INTERVAL_DAYS = 1;

/** Accepted fixed-interval chain for the MVP (SETE-92). */
export const FIXED_INTERVAL_DAYS = [1, 3, 7, 14, 30, 60, 120];

export type CalculateNextReviewStateInput = {
  rating: ReviewRating;
  currentIntervalDays: number;
  reviewedAt?: string;
};

export type NextReviewState = {
  intervalDays: number;
  nextReviewAt: string;
};

function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function nextRememberedInterval(currentIntervalDays: number): number {
  const next = FIXED_INTERVAL_DAYS.find(days => days > currentIntervalDays);
  return next ?? FIXED_INTERVAL_DAYS[FIXED_INTERVAL_DAYS.length - 1];
}

/**
 * MVP scheduler (SETE-92): a fixed-interval, two-rating model.
 *
 * - `remembered` advances the card to the next fixed bucket in
 *   `[1, 3, 7, 14, 30, 60, 120]` (capped at 120).
 * - `forgot` resets the card to a 1-day relearn.
 */
export function calculateNextReviewState({
  rating,
  currentIntervalDays,
  reviewedAt = new Date().toISOString(),
}: CalculateNextReviewStateInput): NextReviewState {
  const intervalDays =
    rating === 'remembered'
      ? nextRememberedInterval(currentIntervalDays)
      : DEFAULT_REVIEW_INTERVAL_DAYS;

  return {
    intervalDays,
    nextReviewAt: addDays(reviewedAt, intervalDays),
  };
}
