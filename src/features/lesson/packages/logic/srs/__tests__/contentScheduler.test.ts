import {
  CONTENT_INTERVAL_MINUTES,
  calculateNextContentReviewState,
} from '../contentScheduler';
import type {ContentMasteryState} from '../contentScheduler';

const REVIEWED_AT = '2026-08-17T12:00:00.000Z';

describe('calculateNextContentReviewState (fixed-interval schedule, REQ-26)', () => {
  it('schedules the first-ever review at 10 minutes', () => {
    const result = calculateNextContentReviewState({
      itemType: 'vocabulary',
      currentState: 'new',
      outcome: {correct: true},
      reviewedAt: REVIEWED_AT,
    });

    expect(result.intervalMinutes).toBe(10);
    expect(result.nextReviewAt).toBe('2026-08-17T12:10:00.000Z');
    expect(result.state).toBe('learning');
  });

  it('walks the full fixed-interval chain in order and caps at 120 days', () => {
    let currentState: ContentMasteryState = 'new';
    let currentIntervalMinutes: number | undefined;

    for (const expectedMinutes of CONTENT_INTERVAL_MINUTES) {
      const result = calculateNextContentReviewState({
        itemType: 'vocabulary',
        currentState,
        currentIntervalMinutes,
        outcome: {correct: true},
        reviewedAt: REVIEWED_AT,
      });
      expect(result.intervalMinutes).toBe(expectedMinutes);
      currentState = result.state;
      currentIntervalMinutes = result.intervalMinutes;
    }

    // One more correct review at the top of the chain stays capped at 120 days.
    const capped = calculateNextContentReviewState({
      itemType: 'vocabulary',
      currentState,
      currentIntervalMinutes,
      outcome: {correct: true},
      reviewedAt: REVIEWED_AT,
    });
    expect(capped.intervalMinutes).toBe(
      CONTENT_INTERVAL_MINUTES[CONTENT_INTERVAL_MINUTES.length - 1],
    );
    expect(capped.state).toBe('mastered');
  });

  it('resets to the shortest interval and relearning state on a forgotten review', () => {
    const result = calculateNextContentReviewState({
      itemType: 'vocabulary',
      currentState: 'mastered',
      currentIntervalMinutes:
        CONTENT_INTERVAL_MINUTES[CONTENT_INTERVAL_MINUTES.length - 1],
      outcome: {correct: false},
      reviewedAt: REVIEWED_AT,
    });

    expect(result.intervalMinutes).toBe(CONTENT_INTERVAL_MINUTES[0]);
    expect(result.state).toBe('relearning');
  });
});

describe('mastery lifecycle (REQ-25)', () => {
  it('covers all five states across a realistic run', () => {
    const seen = new Set<ContentMasteryState>(['new']);

    let currentState: ContentMasteryState = 'new';
    let currentIntervalMinutes: number | undefined;
    for (let i = 0; i < CONTENT_INTERVAL_MINUTES.length; i += 1) {
      const result = calculateNextContentReviewState({
        itemType: 'grammar',
        currentState,
        currentIntervalMinutes,
        outcome: {correct: true},
        reviewedAt: REVIEWED_AT,
      });
      seen.add(result.state);
      currentState = result.state;
      currentIntervalMinutes = result.intervalMinutes;
    }

    const relearned = calculateNextContentReviewState({
      itemType: 'grammar',
      currentState,
      currentIntervalMinutes,
      outcome: {correct: false},
      reviewedAt: REVIEWED_AT,
    });
    seen.add(relearned.state);

    expect(seen).toEqual(
      new Set<ContentMasteryState>([
        'new',
        'learning',
        'reviewing',
        'mastered',
        'relearning',
      ]),
    );
  });

  it('throws rather than silently corrupting state on an invalid mastery state', () => {
    expect(() =>
      calculateNextContentReviewState({
        itemType: 'vocabulary',
        // @ts-expect-error deliberately invalid for this test
        currentState: 'bogus',
        outcome: {correct: true},
        reviewedAt: REVIEWED_AT,
      }),
    ).toThrow();
  });
});

describe('generalized across item types (REQ-24, VC-5)', () => {
  it('produces identical scheduling math for vocabulary and dialogue_turn items', () => {
    const base = {
      currentState: 'reviewing' as ContentMasteryState,
      currentIntervalMinutes: CONTENT_INTERVAL_MINUTES[3],
      outcome: {correct: true},
      reviewedAt: REVIEWED_AT,
    };

    const vocabulary = calculateNextContentReviewState({
      itemType: 'vocabulary',
      ...base,
    });
    const dialogueTurn = calculateNextContentReviewState({
      itemType: 'dialogue_turn',
      ...base,
    });

    expect(dialogueTurn).toEqual(vocabulary);
  });
});

describe('scoring inputs (REQ-27)', () => {
  it('advances a fast, hint-free correct answer further than a hinted/slow one', () => {
    const base = {
      itemType: 'qa',
      currentState: 'reviewing' as ContentMasteryState,
      currentIntervalMinutes: CONTENT_INTERVAL_MINUTES[3],
      reviewedAt: REVIEWED_AT,
    };

    const fastNoHints = calculateNextContentReviewState({
      ...base,
      outcome: {correct: true, hintsUsed: 0, responseTimeMs: 1500},
    });
    const hintedAndSlow = calculateNextContentReviewState({
      ...base,
      outcome: {correct: true, hintsUsed: 1, responseTimeMs: 12000},
    });

    expect(hintedAndSlow.intervalMinutes).toBeLessThan(
      fastNoHints.intervalMinutes,
    );
  });

  it('does not require hints/response-time signals an activity never captured', () => {
    const result = calculateNextContentReviewState({
      itemType: 'qa',
      currentState: 'reviewing',
      currentIntervalMinutes: CONTENT_INTERVAL_MINUTES[3],
      outcome: {correct: true},
      reviewedAt: REVIEWED_AT,
    });

    expect(result.intervalMinutes).toBe(CONTENT_INTERVAL_MINUTES[4]);
  });
});
