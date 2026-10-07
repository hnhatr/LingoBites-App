import type {StudyBlockPlan, TodayMode} from '@features/today';

import {getDatabase} from '@core/db/database';

/**
 * The Home study plan kept for one local day, in the local `app_settings`
 * table. The Today engine rebuilds its plan from live state, so a finished
 * review would drop out of the list instead of showing as done; storing the
 * day's plan keeps the checklist stable. Device-local and not synced. Reads
 * and writes never throw.
 */
export const TODAY_PLAN_KEY = 'home.today_plan';

export type StoredTodayPlan = {
  dayKey: string;
  mode: TodayMode;
  plan: StudyBlockPlan;
};

function isStoredTodayPlan(value: unknown): value is StoredTodayPlan {
  const candidate = value as Partial<StoredTodayPlan> | null;
  return (
    candidate != null &&
    typeof candidate.dayKey === 'string' &&
    typeof candidate.mode === 'string' &&
    candidate.plan != null &&
    Array.isArray(candidate.plan.activities)
  );
}

export function readStoredTodayPlan(): StoredTodayPlan | null {
  try {
    const result = getDatabase().execute(
      'SELECT value FROM app_settings WHERE key = ? LIMIT 1;',
      [TODAY_PLAN_KEY],
    );
    const row = result.rows?.item(0) as {value?: string} | undefined;
    if (!row?.value) {
      return null;
    }
    const parsed: unknown = JSON.parse(row.value);
    return isStoredTodayPlan(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeStoredTodayPlan(stored: StoredTodayPlan): void {
  try {
    getDatabase().execute(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      [TODAY_PLAN_KEY, JSON.stringify(stored), new Date().toISOString()],
    );
  } catch (error) {
    console.log('[TodayPlanRepository] write failed', error);
  }
}
