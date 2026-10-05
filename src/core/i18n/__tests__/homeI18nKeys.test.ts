/**
 * i18n key parity test for Home screen new keys (LING-256 TASK-002, A-004).
 *
 * Verifies that every new home locale key added for the redesign exists in
 * both vi.json and en.json with a non-empty string value.
 */

import en from '../en.json';
import vi from '../vi.json';

const NEW_HOME_KEYS = [
  // Greeting (I5, DQ-008)
  'home.greeting_morning',
  'home.greeting_afternoon',
  'home.greeting_night',
  // Streak (I4, P-001)
  'home.streak_days',
  'home.streak_zero',
  // Paw goal (I3, P-004)
  'home.paw_goal_a11y',
  'home.paw_goal_label',
  // Hero states (DQ-002)
  'home.hero_no_lessons_title',
  'home.hero_no_lessons_body',
  'home.hero_no_lessons_cta',
  'home.hero_saved_title',
  'home.hero_saved_body',
  'home.hero_saved_cta',
  'home.hero_in_progress_title',
  'home.hero_in_progress_cta',
  'home.hero_goal_met_title',
  'home.hero_goal_met_body',
  'home.hero_goal_met_cta',
  'home.hero_youtube_disabled_title',
  'home.hero_youtube_disabled_body',
  'home.hero_youtube_disabled_cta',
  // Mascot speech bubbles
  'home.mascot_no_lessons',
  'home.mascot_saved',
  'home.mascot_in_progress',
  'home.mascot_goal_met',
  'home.mascot_youtube_disabled',
  // Shortcuts (DQ-005)
  'home.shortcut_lessons',
  'home.shortcut_video',
  'home.shortcut_video_locked',
  // Saved rail (DQ-006)
  'home.saved_rail_title',
  'home.saved_rail_view_all',
  'home.saved_rail_view_all_a11y',
  'home.saved_rail_empty',
  // Hero eyebrow labels (Gap 5, LING-261)
  'home.hero_eyebrow_no_lessons',
  'home.hero_eyebrow_saved',
  'home.hero_eyebrow_in_progress',
  'home.hero_eyebrow_youtube_disabled',
  'home.hero_eyebrow_goal_met',
  // Shortcuts section title (Gap 7, LING-261)
  'home.shortcuts_title',
];

function resolveKey(
  obj: Record<string, unknown>,
  dotPath: string,
): string | undefined {
  const parts = dotPath.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

describe('Home i18n key parity (A-004, LING-256 TASK-002)', () => {
  for (const key of NEW_HOME_KEYS) {
    it(`"${key}" exists in vi.json with non-empty value`, () => {
      const value = resolveKey(vi as Record<string, unknown>, key);
      expect(value).toBeDefined();
      expect(typeof value).toBe('string');
      expect((value as string).length).toBeGreaterThan(0);
    });

    it(`"${key}" exists in en.json with non-empty value`, () => {
      const value = resolveKey(en as Record<string, unknown>, key);
      expect(value).toBeDefined();
      expect(typeof value).toBe('string');
      expect((value as string).length).toBeGreaterThan(0);
    });
  }
});
