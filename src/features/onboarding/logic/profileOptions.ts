/**
 * Phase 2 (P2.4): the choices asked at onboarding. Values match the Server's
 * learner profile (`docs/superpowers/plans/2026-10-09-phase2-step0-config.md`,
 * decisions C1, C2, C5); labels live in i18n under `learnerOnboarding`.
 */

export const AGE_GROUPS = ['adults', 'kids'] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

/** Levels with lessons in the trial course (C1). */
export const LEVEL_CODES = ['A1', 'A2'] as const;
export type LevelCode = (typeof LEVEL_CODES)[number];

export const GOALS = ['communication', 'travel', 'work', 'school'] as const;
export type Goal = (typeof GOALS)[number];

export const INTERESTS = [
  'music',
  'movies',
  'sports',
  'cooking',
  'travel',
  'technology',
  'reading',
  'games',
] as const;
export type Interest = (typeof INTERESTS)[number];
export const INTERESTS_MAX = 3;

export const DAILY_MINUTES = [5, 10, 15, 20] as const;
export type DailyMinutes = (typeof DAILY_MINUTES)[number];

/** The trial course the profile's level points into (G1). */
export const LEARNING_COURSE_SLUG = 'tieng-anh-giao-tiep';

export type LearnerProfileInput = {
  ageGroup: AgeGroup;
  levelCode: LevelCode;
  goals: Goal[];
  interests: Interest[];
  dailyMinutes: DailyMinutes;
};

/** "Để sau": an adult starting at A1, ten minutes a day (step-0 §5). */
export const DEFAULT_PROFILE: LearnerProfileInput = {
  ageGroup: 'adults',
  levelCode: 'A1',
  goals: ['communication'],
  interests: [],
  dailyMinutes: 10,
};

/** Adds or removes `value`; adding past `max` is ignored. */
export function toggleChoice<T>(
  list: readonly T[],
  value: T,
  max?: number,
): T[] {
  if (list.includes(value)) return list.filter(entry => entry !== value);
  if (max !== undefined && list.length >= max) return [...list];
  return [...list, value];
}
