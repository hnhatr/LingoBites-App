import {z} from 'zod';

import {getAppConfig} from '@core/api/appConfig';
import {getDatabase} from '@core/db/database';

import type {StudyActivityType} from './types';

/**
 * The features the Today screen may offer, switched on and off by the admin
 * (Server `today.features`, sent in `GET /v1/capabilities`). The last answer
 * is kept on the device so the plan works offline; before the first answer
 * the defaults below apply. Keys this build does not know are ignored.
 */

export type TodayFeatureKey =
  | StudyActivityType
  | 'word_pack'
  | 'add_lesson.create'
  | 'add_lesson.library'
  | 'add_lesson.course';

export type TodayFeatures = Record<TodayFeatureKey, boolean>;

/** Same defaults as the Server's list. */
export const DEFAULT_TODAY_FEATURES: TodayFeatures = {
  due_review: true,
  continue_lesson: true,
  error_remediation: true,
  prerequisite_lesson: true,
  next_lesson: true,
  old_situation_practice: true,
  speaking_practice: true,
  listening_remediation: false,
  interview_practice: false,
  // Not in the Server's list yet: no rule plans this activity today.
  active_recall: true,
  word_pack: true,
  'add_lesson.create': true,
  'add_lesson.library': true,
  'add_lesson.course': true,
};

/** Always on, so the plan is never empty. */
const LOCKED_FEATURES: readonly TodayFeatureKey[] = [
  'due_review',
  'continue_lesson',
];

export const TODAY_FEATURES_SETTING_KEY = 'today.features';

const FeatureMapSchema = z.record(z.string(), z.boolean());

const CapabilitiesSchema = z.object({
  capabilities: z.object({
    today: z.object({features: FeatureMapSchema}),
  }),
});

/** A saved or received map over the defaults; locked features stay on. */
export function resolveTodayFeatures(value: unknown): TodayFeatures {
  const parsed = FeatureMapSchema.safeParse(value);
  const saved = parsed.success ? parsed.data : {};
  const resolved = {...DEFAULT_TODAY_FEATURES};
  for (const key of Object.keys(resolved) as TodayFeatureKey[]) {
    if (typeof saved[key] === 'boolean') resolved[key] = saved[key];
  }
  for (const key of LOCKED_FEATURES) resolved[key] = true;
  return resolved;
}

/** The features as last received, or the defaults. */
export function readTodayFeatures(): TodayFeatures {
  try {
    const row = getDatabase()
      .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [
        TODAY_FEATURES_SETTING_KEY,
      ])
      .rows?.item(0) as {value?: string} | undefined;
    return resolveTodayFeatures(row?.value ? JSON.parse(row.value) : null);
  } catch {
    return resolveTodayFeatures(null);
  }
}

function writeTodayFeatures(features: Record<string, boolean>): void {
  getDatabase().execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    [
      TODAY_FEATURES_SETTING_KEY,
      JSON.stringify(features),
      new Date().toISOString(),
    ],
  );
}

/**
 * Asks the Server for the features and keeps the answer. Returns the
 * features to use: the new ones, or what was kept when the Server cannot be
 * reached or is older and does not send them.
 */
export async function refreshTodayFeatures(
  options: {fetchImpl?: typeof fetch; signal?: AbortSignal} = {},
): Promise<TodayFeatures> {
  try {
    const {apiBaseUrl} = getAppConfig();
    const response = await (options.fetchImpl ?? fetch)(
      `${apiBaseUrl}/v1/capabilities`,
      {headers: {Accept: 'application/json'}, signal: options.signal},
    );
    if (!response.ok) return readTodayFeatures();
    const parsed = CapabilitiesSchema.safeParse(await response.json());
    if (!parsed.success) return readTodayFeatures();
    writeTodayFeatures(parsed.data.capabilities.today.features);
    return resolveTodayFeatures(parsed.data.capabilities.today.features);
  } catch {
    return readTodayFeatures();
  }
}
