/**
 * Golden-hour reminder planning (REQ-10 / SETE-89).
 *
 * Reminders mirror each card's SRS due time (`review_schedule.next_review_at`,
 * the Stage-1 schema field) as local notifications. Because the OS owns the
 * pending-notification state, the planner here is a pure reconciliation between
 * what the DB says should be pending and what the OS actually has pending:
 *
 *  - a pending notification whose card is no longer due in the future, or whose
 *    due time has changed, is cancelled (stale / reschedule),
 *  - a due-in-the-future card with no matching pending notification is
 *    scheduled (this also covers the first schedule after a review moved the
 *    card's due time forward).
 *
 * The notification delivery itself is an injected port (native), so this file
 * stays deterministic and unit-testable.
 */

import type {UpcomingReviewReminder} from '@features/review';

export type {UpcomingReviewReminder};

/** What the OS currently has pending, keyed per card. */
export type PendingReminder = {
  cardId: string;
  dueAt: string;
};

export type ReminderPlan = {
  toSchedule: UpcomingReviewReminder[];
  toCancel: string[];
};

function matchingKey(cardId: string, dueAt: string): string {
  return `${cardId}|${dueAt}`;
}

/**
 * Computes the minimal reconciliation plan to make the OS pending set equal the
 * set of reminders the DB wants. A pending notification is cancelled when the
 * card is no longer due in the future or its due time changed; an upcoming
 * reminder is scheduled only when no matching pending notification exists, so
 * the plan is idempotent (re-running it is a no-op).
 */
export function computeReminderPlan({
  upcoming,
  pending,
}: {
  upcoming: readonly UpcomingReviewReminder[];
  pending: readonly PendingReminder[];
}): ReminderPlan {
  const pendingByCard = new Map<string, PendingReminder>();
  for (const item of pending) {
    pendingByCard.set(item.cardId, item);
  }

  const toSchedule: UpcomingReviewReminder[] = [];
  for (const reminder of upcoming) {
    const current = pendingByCard.get(reminder.cardId);
    if (current === undefined || current.dueAt !== reminder.dueAt) {
      toSchedule.push(reminder);
    }
  }

  const upcomingByKey = new Set(
    upcoming.map(reminder => matchingKey(reminder.cardId, reminder.dueAt)),
  );
  const toCancel = pending
    .filter(item => !upcomingByKey.has(matchingKey(item.cardId, item.dueAt)))
    .map(item => item.cardId);

  return {toSchedule, toCancel};
}

/** Copy shown by the scheduled local notification. */
export const REVIEW_REMINDER_TITLE = 'Đến giờ ôn tập';
export const REVIEW_REMINDER_BODY = (word: string): string =>
  `"${word}" — mở LingoBites để ôn tập đúng lịch.`;
