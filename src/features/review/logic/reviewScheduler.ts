import {
  calculateNextReviewState,
  type CalculateNextReviewStateInput,
  DEFAULT_REVIEW_INTERVAL_DAYS,
  FIXED_INTERVAL_DAYS,
  type NextReviewState,
} from '@features/review/logic/reviewPolicy';

import type {ReviewScheduleRecord} from '@core/db/types';

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
