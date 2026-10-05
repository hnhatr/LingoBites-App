/**
 * Learner reminder settings from Profile → Cài đặt → Nhắc nhở (F6).
 *
 * `enabled` switches every reminder on or off: the Golden Hour reminders at
 * each card's SRS due time and the optional daily study reminder. `dailyTime`
 * is the local `HH:MM` the daily reminder fires at, or null for Golden Hour
 * reminders only. The default keeps today's behaviour: Golden Hour on, no
 * daily reminder.
 */
export type ReminderSettings = {
  enabled: boolean;
  dailyTime: string | null;
};

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: true,
  dailyTime: null,
};

/** Daily reminder times offered in the picker (local time). */
export const DAILY_REMINDER_TIME_OPTIONS = [
  '07:00',
  '12:00',
  '20:00',
  '21:00',
] as const;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Splits a valid `HH:MM` string, or returns null. */
export function parseReminderTime(
  value: string,
): {hour: number; minute: number} | null {
  const match = TIME_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  return {hour: Number(match[1]), minute: Number(match[2])};
}

/** Parses the stored JSON; anything unreadable falls back to the default. */
export function parseReminderSettings(raw: string | null): ReminderSettings {
  if (raw === null) {
    return DEFAULT_REMINDER_SETTINGS;
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return DEFAULT_REMINDER_SETTINGS;
  }
  if (typeof value !== 'object' || value === null) {
    return DEFAULT_REMINDER_SETTINGS;
  }
  const record = value as {enabled?: unknown; dailyTime?: unknown};
  const enabled =
    typeof record.enabled === 'boolean'
      ? record.enabled
      : DEFAULT_REMINDER_SETTINGS.enabled;
  const dailyTime =
    typeof record.dailyTime === 'string' &&
    parseReminderTime(record.dailyTime) !== null
      ? record.dailyTime
      : null;
  return {enabled, dailyTime};
}

/**
 * Next local instant at `HH:MM` strictly after `nowMs` (today if still ahead,
 * otherwise tomorrow). Returns null for an invalid time.
 */
export function nextDailyReminderAtMs(
  time: string,
  nowMs: number,
): number | null {
  const parsed = parseReminderTime(time);
  if (!parsed) {
    return null;
  }
  const now = new Date(nowMs);
  const candidate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    parsed.hour,
    parsed.minute,
    0,
    0,
  );
  if (candidate.getTime() <= nowMs) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate.getTime();
}
