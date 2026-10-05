import type {AndroidChannel} from '@notifee/react-native';
import notifee, {
  AndroidImportance,
  RepeatFrequency,
  TriggerType,
} from '@notifee/react-native';
import {Platform} from 'react-native';

import {
  readReminderSettingsRaw,
  writeReminderSettingsRaw,
} from './data/EngagementSettingsRepository';
import {
  configureNativeReminderNotifications,
  DAILY_REMINDER_NOTIFICATION_ID,
  type NotifeeLike,
  type ReminderPermissionStatus,
} from './nativeReminderScheduler';
import {reconcileReminders, setReviewRemindersEnabled} from './reminderService';
import {
  nextDailyReminderAtMs,
  parseReminderSettings,
  type ReminderSettings,
} from './reminderSettingsPolicy';

/**
 * Applies the learner's reminder settings (F6) to the OS.
 *
 * The on/off switch gates Golden Hour reminders through the reconcile in
 * `reminderService`; the daily study reminder is one repeating notifee
 * trigger with a fixed id, re-created on each apply so a new time replaces
 * the old one. Like the Golden Hour adapter, nothing here throws.
 */

export const DAILY_REMINDER_CHANNEL_ID = 'daily-study-reminder';
export const DAILY_REMINDER_CHANNEL_NAME = 'Nhắc học hằng ngày';
export const DAILY_REMINDER_TITLE = 'Đến giờ học rồi!';
export const DAILY_REMINDER_BODY =
  'Dành vài phút với LingoBites để giữ chuỗi ngày nhé.';

export type ReminderApplyResult =
  | ReminderPermissionStatus
  /** Reminders are switched off; nothing was asked of the OS. */
  | 'off';

export function getReminderSettings(): ReminderSettings {
  return parseReminderSettings(readReminderSettingsRaw());
}

/** Persists the settings; returns false when the write fails. */
export function saveReminderSettings(settings: ReminderSettings): boolean {
  try {
    writeReminderSettingsRaw(JSON.stringify(settings));
    return true;
  } catch (error) {
    console.log('[reminderSettings] write failed', error);
    return false;
  }
}

function dailyChannel(): AndroidChannel {
  return {
    id: DAILY_REMINDER_CHANNEL_ID,
    name: DAILY_REMINDER_CHANNEL_NAME,
    description: 'Nhắc mở LingoBites mỗi ngày vào giờ bạn chọn.',
    importance: AndroidImportance.HIGH,
  };
}

/** Schedules (or cancels) the repeating daily reminder to match settings. */
export async function syncDailyReminder(
  api: NotifeeLike,
  settings: ReminderSettings,
  nowMs = Date.now(),
): Promise<void> {
  const fireAtMs =
    settings.enabled && settings.dailyTime
      ? nextDailyReminderAtMs(settings.dailyTime, nowMs)
      : null;
  if (fireAtMs === null) {
    await api
      .cancelTriggerNotification(DAILY_REMINDER_NOTIFICATION_ID)
      .catch(() => {});
    return;
  }
  if (Platform.OS === 'android') {
    await api.createChannel(dailyChannel()).catch(() => '');
  }
  // Same id → notifee replaces any earlier daily trigger.
  await api
    .createTriggerNotification(
      {
        id: DAILY_REMINDER_NOTIFICATION_ID,
        title: DAILY_REMINDER_TITLE,
        body: DAILY_REMINDER_BODY,
        data: {kind: 'daily-study-reminder'},
        android: {channelId: DAILY_REMINDER_CHANNEL_ID},
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: fireAtMs,
        repeatFrequency: RepeatFrequency.DAILY,
      },
    )
    .catch(() => '');
}

/**
 * Pushes the stored settings to the OS. With `prompt` (the learner just
 * changed the setting) permission is asked even when no card is due; at app
 * start it is only asked when a card is due, as before.
 */
export async function applyReminderSettings(
  opts: {api?: NotifeeLike; prompt?: boolean; nowMs?: number} = {},
): Promise<ReminderApplyResult> {
  const api = opts.api ?? notifee;
  const settings = getReminderSettings();
  setReviewRemindersEnabled(settings.enabled);

  if (!settings.enabled) {
    reconcileReminders();
    await syncDailyReminder(api, settings, opts.nowMs);
    return 'off';
  }

  const status = await configureNativeReminderNotifications(api, {
    reminderWanted: opts.prompt === true,
  }).catch((): ReminderPermissionStatus => 'unavailable');
  if (status === 'granted') {
    await syncDailyReminder(api, settings, opts.nowMs);
  }
  return status;
}
