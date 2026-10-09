import {getDatabase} from '@core/db/database';

import {
  AGE_GROUPS,
  DAILY_MINUTES,
  GOALS,
  INTERESTS,
  type LearnerProfileInput,
  LEVEL_CODES,
} from './profileOptions';

/**
 * Phase 2 (P2.4): the learner profile kept on the device, so the app opens
 * without waiting for the network and onboarding works offline. `pending`
 * marks answers not yet saved on the Server; the store sends them on the
 * next start. The row names its account so a switched account is asked
 * again rather than inheriting another learner's profile.
 */
export const LEARNER_PROFILE_CACHE_KEY = 'onboarding.learner_profile';

export type CachedLearnerProfile = {
  userId: string;
  profile: LearnerProfileInput;
  pending: boolean;
};

function isOneOf<T extends string | number>(
  values: readonly T[],
  value: unknown,
): value is T {
  return (values as readonly unknown[]).includes(value);
}

/** Keeps only known values, so a stale or edited row cannot break the app. */
export function sanitizeProfile(raw: unknown): LearnerProfileInput | null {
  if (raw === null || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (
    !isOneOf(AGE_GROUPS, value.ageGroup) ||
    !isOneOf(LEVEL_CODES, value.levelCode) ||
    !isOneOf(DAILY_MINUTES, value.dailyMinutes)
  ) {
    return null;
  }
  const list = <T extends string>(values: readonly T[], entries: unknown) =>
    Array.isArray(entries)
      ? entries.filter((entry): entry is T => isOneOf(values, entry))
      : [];
  const goals = list(GOALS, value.goals);
  return {
    ageGroup: value.ageGroup,
    levelCode: value.levelCode,
    goals: goals.length > 0 ? goals : ['communication'],
    interests: list(INTERESTS, value.interests).slice(0, 3),
    dailyMinutes: value.dailyMinutes,
  };
}

export function readCachedProfile(userId: string): CachedLearnerProfile | null {
  try {
    const row = getDatabase()
      .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [
        LEARNER_PROFILE_CACHE_KEY,
      ])
      .rows?.item(0) as {value?: string} | undefined;
    if (!row?.value) return null;
    const parsed = JSON.parse(row.value) as Partial<CachedLearnerProfile>;
    const profile = sanitizeProfile(parsed.profile);
    if (parsed.userId !== userId || !profile) return null;
    return {userId, profile, pending: parsed.pending === true};
  } catch {
    return null;
  }
}

export function writeCachedProfile(
  entry: CachedLearnerProfile,
  now: Date = new Date(),
): void {
  try {
    getDatabase().execute(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      [LEARNER_PROFILE_CACHE_KEY, JSON.stringify(entry), now.toISOString()],
    );
  } catch {
    // The Server keeps the profile; a failed local write only costs a refetch.
  }
}
