import {listUpcomingReviewReminders} from '@features/review';

import type {PendingReminder} from './reminderPolicy';
import {
  computeReminderPlan,
  REVIEW_REMINDER_BODY,
  REVIEW_REMINDER_TITLE,
} from './reminderPolicy';

/**
 * Golden-hour reminders (REQ-10 / SETE-89).
 *
 * Reminders are local notifications scheduled at each card's SRS due time
 * (`review_schedule.next_review_at`, the Stage-1 `dueAt` field). The OS owns
 * the pending-notification state, so the service reconciles the DB's desired
 * reminders against what the OS actually has pending: stale notifications for
 * cards that were reviewed (no longer due in the future) or whose due time
 * changed are cancelled, and cards that became due in the future are scheduled.
 * Reconcile runs on every app start and after review sessions, so force-quit
 * and relaunch keeps reminders consistent with the schedule.
 *
 * Delivery itself is an injected port because scheduling real notifications is
 * native work (iOS/Android notification APIs). See `noopReminderScheduler`;
 * wiring a real adapter (e.g. a local-notification library) is the device
 * integration slice, mirroring how chapter-audio downloads inject their native
 * file store.
 */

export type ReminderScheduler = {
  /** What the OS currently has pending, one entry per card. */
  listPending: () => PendingReminder[];
  /** Schedules a notification that fires at the card's due time. */
  schedule: (params: {cardId: string; word: string; dueAt: string}) => void;
  /** Cancels any pending notification for the card. */
  cancel: (cardId: string) => void;
};

export type ReminderSyncResult = {
  scheduled: number;
  cancelled: number;
};

/** Safe default until a native notification adapter is wired in. */
export const noopReminderScheduler: ReminderScheduler = {
  listPending: () => [],
  schedule: () => {},
  cancel: () => {},
};

// The scheduler is installed once at startup by the native integration slice
// (see `configureReminderScheduler`); every reconciliation runs against it.
// Before installation the no-op scheduler keeps the app safe and testable.
let activeScheduler: ReminderScheduler = noopReminderScheduler;

/** Installs the real OS notification adapter (native integration slice). */
export function configureReminderScheduler(scheduler: ReminderScheduler): void {
  activeScheduler = scheduler;
}

/** Reconciles reminders against the installed scheduler. */
export function reconcileReminders(
  now = new Date().toISOString(),
): ReminderSyncResult {
  return syncReviewReminders(activeScheduler, now);
}

/** Reconciles OS pending notifications with the DB's desired reminder set. */
export function syncReviewReminders(
  scheduler: ReminderScheduler,
  now = new Date().toISOString(),
): ReminderSyncResult {
  const upcoming = listUpcomingReviewReminders(now);
  const plan = computeReminderPlan({
    upcoming,
    pending: scheduler.listPending(),
  });

  for (const cardId of plan.toCancel) {
    scheduler.cancel(cardId);
  }
  for (const reminder of plan.toSchedule) {
    scheduler.schedule({
      cardId: reminder.cardId,
      word: reminder.word,
      dueAt: reminder.dueAt,
    });
  }

  return {scheduled: plan.toSchedule.length, cancelled: plan.toCancel.length};
}

/** Copy for the notification that fires when a card reaches its due time. */
export function buildReminderNotification(card: {
  word: string;
  dueAt: string;
}): {title: string; body: string; fireAt: string} {
  return {
    title: REVIEW_REMINDER_TITLE,
    body: REVIEW_REMINDER_BODY(card.word),
    fireAt: card.dueAt,
  };
}
