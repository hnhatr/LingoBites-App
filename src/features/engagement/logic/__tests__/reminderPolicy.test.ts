import {
  computeReminderPlan,
  REVIEW_REMINDER_BODY,
  REVIEW_REMINDER_TITLE,
} from '../reminderPolicy';
import type {PendingReminder, UpcomingReviewReminder} from '../reminderPolicy';

const card = (cardId: string, dueAt: string): UpcomingReviewReminder => ({
  cardId,
  word: `word-${cardId}`,
  dueAt,
});

describe('reminderPolicy', () => {
  it('schedules every upcoming card when nothing is pending', () => {
    const plan = computeReminderPlan({
      upcoming: [card('a', '2026-09-06T08:00:00.000Z')],
      pending: [],
    });
    expect(plan.toSchedule).toEqual([card('a', '2026-09-06T08:00:00.000Z')]);
    expect(plan.toCancel).toEqual([]);
  });

  it('is a no-op when pending already matches upcoming (idempotent)', () => {
    const plan = computeReminderPlan({
      upcoming: [card('a', '2026-09-06T08:00:00.000Z')],
      pending: [
        {cardId: 'a', dueAt: '2026-09-06T08:00:00.000Z'} as PendingReminder,
      ],
    });
    expect(plan.toSchedule).toEqual([]);
    expect(plan.toCancel).toEqual([]);
  });

  it('cancels pending notifications that are no longer due in the future', () => {
    const plan = computeReminderPlan({
      upcoming: [],
      pending: [
        {cardId: 'a', dueAt: '2026-09-06T08:00:00.000Z'} as PendingReminder,
        {cardId: 'b', dueAt: '2026-09-06T08:00:00.000Z'} as PendingReminder,
      ],
    });
    expect(plan.toSchedule).toEqual([]);
    expect(plan.toCancel.sort()).toEqual(['a', 'b']);
  });

  it('reschedules a card whose due time changed (stale reminder)', () => {
    const plan = computeReminderPlan({
      upcoming: [card('a', '2026-09-07T08:00:00.000Z')],
      pending: [{cardId: 'a', dueAt: '2026-09-06T08:00:00.000Z'}],
    });
    expect(plan.toSchedule).toEqual([card('a', '2026-09-07T08:00:00.000Z')]);
    expect(plan.toCancel).toEqual(['a']);
  });

  it('mixes schedule/cancel across cards in one reconciliation', () => {
    const plan = computeReminderPlan({
      upcoming: [
        card('a', '2026-09-06T08:00:00.000Z'),
        card('b', '2026-09-07T08:00:00.000Z'),
      ],
      pending: [
        {cardId: 'a', dueAt: '2026-09-06T08:00:00.000Z'},
        {cardId: 'b', dueAt: '2026-09-06T08:00:00.000Z'}, // stale due time
        {cardId: 'c', dueAt: '2026-09-06T08:00:00.000Z'}, // card no longer upcoming
      ],
    });
    expect(plan.toSchedule).toEqual([card('b', '2026-09-07T08:00:00.000Z')]);
    expect(plan.toCancel.sort()).toEqual(['b', 'c']);
  });

  it('exposes reminder copy for the notification payload', () => {
    expect(REVIEW_REMINDER_TITLE).toBe('Đến giờ ôn tập');
    expect(REVIEW_REMINDER_BODY('hello')).toContain('hello');
  });
});
