import {getDatabase} from '@core/db/database';

/**
 * Learner-chosen engagement settings from Profile → Cài đặt (F6), stored in
 * the local `app_settings` table so reads stay synchronous. Device-local and
 * not synced. Reads never throw: a missing table or row falls back to the
 * caller's default.
 */

export const WEEKLY_GOAL_TARGET_KEY = 'engagement.weekly_goal_target';
export const REMINDER_SETTINGS_KEY = 'engagement.reminder_settings';

function readSetting(key: string): string | null {
  try {
    const result = getDatabase().execute(
      'SELECT value FROM app_settings WHERE key = ? LIMIT 1;',
      [key],
    );
    const row = result.rows?.item(0) as {value?: string} | undefined;
    return row?.value ?? null;
  } catch {
    return null;
  }
}

function writeSetting(key: string, value: string): void {
  getDatabase().execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    [key, value, new Date().toISOString()],
  );
}

/** Raw stored weekly lesson target, or null when the learner never chose. */
export function readWeeklyGoalTargetSetting(): number | null {
  const raw = readSetting(WEEKLY_GOAL_TARGET_KEY);
  if (raw === null) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function writeWeeklyGoalTargetSetting(target: number): void {
  writeSetting(WEEKLY_GOAL_TARGET_KEY, String(target));
}

/** Stored reminder settings JSON (see `parseReminderSettings`), or null. */
export function readReminderSettingsRaw(): string | null {
  return readSetting(REMINDER_SETTINGS_KEY);
}

export function writeReminderSettingsRaw(json: string): void {
  writeSetting(REMINDER_SETTINGS_KEY, json);
}
