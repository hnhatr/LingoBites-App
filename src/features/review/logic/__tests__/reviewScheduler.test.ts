import {
  DEFAULT_REVIEW_INTERVAL_DAYS,
  FIXED_INTERVAL_DAYS,
  calculateNextReviewState,
  selectDueReviewCards,
} from '../reviewScheduler';
import type {ReviewScheduleRecord} from '@shared/db/types';

function schedule(
  overrides: Partial<ReviewScheduleRecord>,
): ReviewScheduleRecord {
  return {
    cardId: overrides.cardId ?? 'card-1',
    lessonId: overrides.lessonId ?? 'lesson-1',
    intervalDays: overrides.intervalDays ?? DEFAULT_REVIEW_INTERVAL_DAYS,
    nextReviewAt: overrides.nextReviewAt ?? '2026-08-17T00:00:00.000Z',
    lastReviewedAt: overrides.lastReviewedAt ?? null,
    createdAt: overrides.createdAt ?? '2026-08-10T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-08-10T00:00:00.000Z',
    revision: 0,
    tombstone: false,
  };
}

describe('reviewScheduler (MVP fixed-interval two-rating)', () => {
  it('increases interval and moves the next review date when remembered', () => {
    const result = calculateNextReviewState({
      rating: 'remembered',
      currentIntervalDays: 1,
      reviewedAt: '2026-08-17T12:00:00.000Z',
    });

    expect(result.intervalDays).toBe(3);
    expect(result.nextReviewAt).toBe('2026-08-20T12:00:00.000Z');
  });

  it('resets interval to tomorrow when forgot', () => {
    const result = calculateNextReviewState({
      rating: 'forgot',
      currentIntervalDays: 14,
      reviewedAt: '2026-08-17T12:00:00.000Z',
    });

    expect(result.intervalDays).toBe(1);
    expect(result.nextReviewAt).toBe('2026-08-18T12:00:00.000Z');
  });

  it('walks the full remembered interval chain 1 -> 3 -> 7 -> 14 -> 30 -> 60 -> 120 -> 120', () => {
    const expectedChain = [1, 3, 7, 14, 30, 60, 120, 120];
    let currentIntervalDays = 0; // start before the first step
    const reviewedAt = '2026-08-17T12:00:00.000Z';

    for (let index = 0; index < expectedChain.length; index += 1) {
      const result = calculateNextReviewState({
        rating: 'remembered',
        currentIntervalDays,
        reviewedAt,
      });
      expect(result.intervalDays).toBe(expectedChain[index]);
      currentIntervalDays = result.intervalDays;
    }
  });

  it('caps the interval chain at 120 days', () => {
    expect(FIXED_INTERVAL_DAYS).toEqual([1, 3, 7, 14, 30, 60, 120]);
    const result = calculateNextReviewState({
      rating: 'remembered',
      currentIntervalDays: 120,
      reviewedAt: '2026-08-17T12:00:00.000Z',
    });
    expect(result.intervalDays).toBe(120);
  });
});

describe('selectDueReviewCards', () => {
  it('selects due cards up to the soft cap and leaves overflow eligible for carry-over', () => {
    const cards = [
      schedule({
        cardId: 'due-oldest',
        nextReviewAt: '2026-08-14T00:00:00.000Z',
      }),
      schedule({
        cardId: 'due-yesterday',
        nextReviewAt: '2026-08-16T00:00:00.000Z',
      }),
      schedule({
        cardId: 'due-today',
        nextReviewAt: '2026-08-17T23:59:59.000Z',
      }),
      schedule({cardId: 'future', nextReviewAt: '2026-08-18T00:00:00.000Z'}),
    ];

    const due = selectDueReviewCards(cards, {
      today: '2026-08-17T12:00:00.000Z',
      limit: 2,
    });

    expect(due.map(card => card.cardId)).toEqual([
      'due-oldest',
      'due-yesterday',
    ]);
  });
});
