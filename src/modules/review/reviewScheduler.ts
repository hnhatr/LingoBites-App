import type {ReviewRating, ReviewScheduleRecord} from '@shared/db/types';
import {
  DEFAULT_REVIEW_INTERVAL_DAYS,
  FIXED_INTERVAL_DAYS,
  calculateNextReviewState,
  type CalculateNextReviewStateInput,
  type NextReviewState,
} from '@shared/review/reviewPolicy';

export {
  DEFAULT_REVIEW_INTERVAL_DAYS,
  FIXED_INTERVAL_DAYS,
  calculateNextReviewState,
};
export type {CalculateNextReviewStateInput, NextReviewState};

type SelectDueReviewCardsOptions = {
  today?: string;
  limit?: number;
};

function endOfUtcDay(isoDate: string): number {
  const date = new Date(isoDate);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    23,
    59,
    59,
    999,
  );
}

export function selectDueReviewCards(
  schedules: ReviewScheduleRecord[],
  {today = new Date().toISOString(), limit}: SelectDueReviewCardsOptions = {},
): ReviewScheduleRecord[] {
  const dueBy = endOfUtcDay(today);
  const due = schedules
    .filter(schedule => new Date(schedule.nextReviewAt).getTime() <= dueBy)
    .sort((a, b) => a.nextReviewAt.localeCompare(b.nextReviewAt));

  if (!limit || limit <= 0) {
    return due;
  }

  return due.slice(0, limit);
}
