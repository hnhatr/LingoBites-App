import type {
  AndroidChannel,
  Notification,
  NotificationSettings,
  TimestampTrigger,
  TriggerNotification,
} from '@notifee/react-native';
import notifee, {
  AndroidImportance,
  AuthorizationStatus,
  TriggerType,
} from '@notifee/react-native';
import {Platform} from 'react-native';

import {listUpcomingReviewReminders} from '@features/review';

import type {PendingReminder} from './reminderPolicy';
import type {ReminderScheduler} from './reminderService';
import {
  buildReminderNotification,
  configureReminderScheduler,
  reconcileReminders,
} from './reminderService';

/**
 * Real on-device Golden Hour notifications (REQ-10 / VC-5 / SETE-90).
 *
 * Stage 3 shipped the `ReminderScheduler` port plus the no-op scheduler; this
 * file installs the real OS adapter over `@notifee/react-native`. Local trigger
 * notifications are scheduled at each card's SRS due time (`next_review_at`)
 * and reconciled exactly as the port describes:
 *
 *  - the native scheduler keeps a shadow copy of what the OS has pending, keyed
 *    per card, so the synchronous reconcile planner can run unchanged;
 *  - before each app-start reconcile the shadow is refreshed from
 *    `getTriggerNotifications()` (force-quit + relaunch keeps reminders
 *    consistent with whatever the OS actually still holds);
 *  - every native call is fire-and-forget with a synchronous shadow update and
 *    a rollback on failure, so a denied/revoked permission or an unavailable
 *    native module can never throw into the review flow — the no-op scheduler
 *    stays the fallback until permission is granted.
 */

/** Android notification channel all Golden Hour reminders post to. */
export const GOLDEN_HOUR_CHANNEL_ID = 'golden-hour-review';
export const GOLDEN_HOUR_CHANNEL_NAME = 'Nhắc ôn tập giờ vàng';

/** Permission state as the app reasons about it (never throws). */
export type ReminderPermissionStatus =
  | 'granted'
  | 'denied'
  | 'not-determined'
  | 'unavailable';

/** Structural slice of `@notifee/react-native` the adapter depends on. */
export type NotifeeLike = {
  getNotificationSettings: () => Promise<NotificationSettings>;
  requestPermission: () => Promise<NotificationSettings>;
  createChannel: (channel: AndroidChannel) => Promise<string>;
  getTriggerNotifications: () => Promise<TriggerNotification[]>;
  createTriggerNotification: (
    notification: Notification,
    trigger: TimestampTrigger,
  ) => Promise<string>;
  cancelTriggerNotification: (notificationId: string) => Promise<void>;
};

export type NativeReminderScheduler = ReminderScheduler & {
  /** Re-reads the OS pending set into the shadow before a reconcile. */
  refreshPending: () => Promise<void>;
};

/** Maps the OS authorization status onto our non-throwing state. */
export function permissionStatusFromSettings(
  settings: Pick<NotificationSettings, 'authorizationStatus'>,
): ReminderPermissionStatus {
  switch (settings.authorizationStatus) {
    case AuthorizationStatus.AUTHORIZED:
    case AuthorizationStatus.PROVISIONAL:
      return 'granted';
    case AuthorizationStatus.NOT_DETERMINED:
      return 'not-determined';
    case AuthorizationStatus.DENIED:
      return 'denied';
    default:
      return 'unavailable';
  }
}

/**
 * Decides whether asking the OS for permission is worth it right now. We only
 * prompt when a reminder would actually do something (a card is due in the
 * future). Android reports `denied` until the first runtime request (Android 13
 * `POST_NOTIFICATIONS`), so there `denied` still warrants a prompt; on iOS a
 * `denied` choice is final and is never re-asked automatically — the learner
 * can re-enable from the OS notification settings.
 */
export function shouldRequestReminderPermission(
  status: ReminderPermissionStatus,
  hasUpcomingReminder: boolean,
  opts: {requestAfterDenied?: boolean} = {},
): boolean {
  if (status === 'granted' || status === 'unavailable') {
    return false;
  }
  if (!hasUpcomingReminder) {
    return false;
  }
  if (status === 'not-determined') {
    return true;
  }
  return status === 'denied' && opts.requestAfterDenied === true;
}

function androidChannel(): AndroidChannel {
  return {
    id: GOLDEN_HOUR_CHANNEL_ID,
    name: GOLDEN_HOUR_CHANNEL_NAME,
    description: 'Nhắc mở LingoBites đúng "giờ vàng" để ôn từ đúng lịch SRS.',
    importance: AndroidImportance.HIGH,
  };
}

function dueAtOfPending(item: TriggerNotification): string | null {
  const dataDueAt = item.notification.data?.dueAt;
  if (typeof dataDueAt === 'string' && dataDueAt.length > 0) {
    return dataDueAt;
  }
  if (item.trigger.type === TriggerType.TIMESTAMP) {
    const ts = item.trigger.timestamp;
    if (Number.isFinite(ts)) {
      return new Date(ts).toISOString();
    }
  }
  return null;
}

/** Builds the adapter instance the sync `ReminderScheduler` port can consume. */
export function createNativeReminderScheduler(
  api: NotifeeLike,
  opts: {now?: () => number} = {},
): NativeReminderScheduler {
  const nowMs = opts.now ?? (() => Date.now());
  const shadow = new Map<string, string>();

  function rollbackOnFailure(cardId: string, dueAt: string): void {
    if (shadow.get(cardId) === dueAt) {
      shadow.delete(cardId);
    }
  }

  return {
    listPending: () => {
      const items: PendingReminder[] = [];
      for (const [cardId, dueAt] of shadow.entries()) {
        items.push({cardId, dueAt});
      }
      return items.sort((a, b) => a.cardId.localeCompare(b.cardId));
    },

    schedule: ({cardId, word, dueAt}) => {
      const timestamp = Date.parse(dueAt);
      if (!Number.isFinite(timestamp) || timestamp <= nowMs()) {
        // Past or invalid due instants are never scheduled — reconcile is the
        // only path that decides what should be pending.
        return;
      }
      shadow.set(cardId, dueAt);
      const copy = buildReminderNotification({word, dueAt});
      const notification: Notification = {
        id: cardId,
        title: copy.title,
        body: copy.body,
        data: {kind: 'golden-hour-review', cardId, dueAt},
        android: {channelId: GOLDEN_HOUR_CHANNEL_ID},
      };
      const trigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp,
      };
      api
        .createTriggerNotification(notification, trigger)
        .catch(() => rollbackOnFailure(cardId, dueAt));
    },

    cancel: cardId => {
      shadow.delete(cardId);
      api.cancelTriggerNotification(cardId).catch(() => {});
    },

    refreshPending: async () => {
      let osPending: TriggerNotification[] = [];
      try {
        osPending = await api.getTriggerNotifications();
      } catch {
        // Native module not linked or unavailable: keep the existing shadow.
        // A later reconcile will simply run against what we already know.
        return;
      }
      shadow.clear();
      for (const item of osPending) {
        const cardId = item.notification.id;
        const dueAt = dueAtOfPending(item);
        if (cardId && dueAt) {
          shadow.set(cardId, dueAt);
        }
      }
    },
  };
}

async function installNativeScheduler(
  api: NotifeeLike,
  now: () => string,
): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await api.createChannel(androidChannel());
    } catch {
      // Channel creation failure must not block reminder scheduling; Android
      // falls back to the app default channel when ours is missing.
    }
  }
  const scheduler = createNativeReminderScheduler(api, {
    now: () => Date.parse(now()),
  });
  await scheduler.refreshPending();
  configureReminderScheduler(scheduler);
  reconcileReminders(now());
}

/**
 * Installs real Golden Hour notifications for this launch and reconciles the
 * DB schedule against the OS. Never throws and never blocks the UI:
 *
 *  - already granted → create channel, install adapter, reconcile;
 *  - not granted and a future review exists → ask once, then install on grant;
 *  - denied/unavailable or nothing due → keep the no-op scheduler.
 */
export async function configureNativeReminderNotifications(
  api: NotifeeLike,
  opts: {promptIfUseful?: boolean; now?: () => string} = {},
): Promise<ReminderPermissionStatus> {
  const now = opts.now ?? (() => new Date().toISOString());
  const promptIfUseful = opts.promptIfUseful ?? true;

  let settings: NotificationSettings;
  try {
    settings = await api.getNotificationSettings();
  } catch {
    return 'unavailable';
  }
  if (!settings || typeof settings.authorizationStatus !== 'number') {
    return 'unavailable';
  }

  const status = permissionStatusFromSettings(settings);
  if (status === 'granted') {
    await installNativeScheduler(api, now);
    return 'granted';
  }
  if (status === 'unavailable') {
    return status;
  }

  const hasUpcoming = listUpcomingReviewReminders(now()).length > 0;
  const requestAfterDenied = Platform.OS === 'android';
  if (
    !promptIfUseful ||
    !shouldRequestReminderPermission(status, hasUpcoming, {
      requestAfterDenied,
    })
  ) {
    return status;
  }

  let after: NotificationSettings;
  try {
    after = await api.requestPermission();
  } catch {
    return status;
  }
  const next = permissionStatusFromSettings(after);
  if (next === 'granted') {
    await installNativeScheduler(api, now);
  }
  return next;
}

/** Convenience wrapper wiring the real `@notifee/react-native` module. */
export function bootstrapGoldenHourReminders(opts?: {
  promptIfUseful?: boolean;
  now?: () => string;
}): Promise<ReminderPermissionStatus> {
  return configureNativeReminderNotifications(notifee, opts);
}
