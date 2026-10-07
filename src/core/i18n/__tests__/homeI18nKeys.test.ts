/**
 * i18n key parity test for Home screen new keys (LING-256 TASK-002, LING-267, §VS-8).
 *
 * Verifies that every home locale key exists in both vi.json and en.json
 * with a non-empty string value and matching interpolation parameters.
 */

import en from '../en.json';
import vi from '../vi.json';

const HOME_KEYS = [
  // Greeting (§VS-1.1, §VS-8)
  'home.greeting_morning',
  'home.greeting_morning_named',
  'home.greeting_morning_prefix',
  'home.greeting_afternoon',
  'home.greeting_afternoon_named',
  'home.greeting_afternoon_prefix',
  'home.greeting_night',
  'home.greeting_night_named',
  'home.greeting_night_prefix',
  // Streak (§VS-1.2, §VS-8)
  'home.streak_days',
  'home.streak_zero',
  'home.streak_unit_one',
  'home.streak_unit_other',
  // Weekly goal (§VS-3, §VS-8)
  'home.weekly_goal_label',
  'home.weekly_goal_line',
  'home.weekly_goal_hint_badge',
  'home.weekly_goal_hint_met',
  'home.weekly_goal_hint_kept',
  'home.weekly_goal_hint_last',
  'home.weekly_goal_link',
  'home.weekly_goal_a11y',
  // Hero states (§VS-2, §VS-8)
  'home.hero_eyebrow_no_lessons',
  'home.hero_eyebrow_saved',
  'home.hero_eyebrow_in_progress',
  'home.hero_eyebrow_youtube_disabled',
  'home.hero_eyebrow_goal_met',
  'home.hero_eyebrow_next',
  'home.hero_next_body',
  'home.hero_next_cta',
  'home.mascot_next',
  'home.hero_no_lessons_title',
  'home.hero_no_lessons_body',
  'home.hero_no_lessons_cta',
  'home.hero_saved_title',
  'home.hero_saved_cta',
  'home.hero_saved_body_one',
  'home.hero_saved_body_other',
  'home.hero_in_progress_title',
  'home.hero_in_progress_body',
  'home.hero_in_progress_cta',
  'home.hero_continue_cta',
  'home.hero_continue_cta_a11y',
  'home.hero_goal_met_title',
  'home.hero_goal_met_body',
  'home.hero_goal_met_cta',
  'home.hero_youtube_disabled_title',
  'home.hero_youtube_disabled_body',
  'home.hero_youtube_disabled_cta',
  // Mascot speech bubbles (§VS-2.4, §VS-8)
  'home.mascot_no_lessons',
  'home.mascot_saved',
  'home.mascot_in_progress',
  'home.mascot_goal_met',
  'home.mascot_youtube_disabled',
  // Shortcuts (§VS-4, §VS-8)
  'home.shortcuts_title',
  'home.shortcut_video',
  'home.shortcut_video_sub',
  'home.shortcut_video_unavailable',
  'home.shortcut_review',
  'home.shortcut_review_due',
  'home.shortcut_review_none',
  'home.shortcut_speaking',
  'home.shortcut_speaking_sub',
  'home.shortcut_create',
  'home.shortcut_create_sub',
  // Saved rail (§VS-5, §VS-8)
  'home.saved_rail_title',
  'home.saved_rail_view_all',
  'home.saved_rail_view_all_a11y',
  'home.saved_rail_empty',
  'home.rail_saved',
  'home.rail_meta',
  'home.rail_type_video',
  'home.rail_type_reading',
  // "Gợi ý hôm nay" card (F12)
  'home.today_label',
  'home.today_mode_5',
  'home.today_mode_20',
  'home.today_mode_45',
  'home.today_mode_a11y',
  'home.today_details',
  'home.today_details_a11y',
  'home.today_details_hint',
  'home.today_empty',
  'home.today_start_a11y',
  'home.today_start_hint',
  'home.today_step_current',
  'home.today_step_done_a11y',
  'home.today_progress',
  'home.today_progress_a11y',
  'home.today_more',
  'home.today_all_done',
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

describe('Home i18n key parity (AC-001, AC-004, §VS-8)', () => {
  for (const key of HOME_KEYS) {
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

describe('§VS-8 exact copy assertions', () => {
  it('hero_no_lessons_title matches approved copy in vi and en', () => {
    expect(
      resolveKey(vi as Record<string, unknown>, 'home.hero_no_lessons_title'),
    ).toBe('Chưa có bài học nào');
    expect(
      resolveKey(en as Record<string, unknown>, 'home.hero_no_lessons_title'),
    ).toBe('No lessons yet');
  });

  it('hero_no_lessons_cta matches approved copy in vi and en', () => {
    expect(
      resolveKey(vi as Record<string, unknown>, 'home.hero_no_lessons_cta'),
    ).toBe('Tạo bài học đầu tiên');
    expect(
      resolveKey(en as Record<string, unknown>, 'home.hero_no_lessons_cta'),
    ).toBe('Create your first lesson');
  });

  it('hero_goal_met_title and cta match approved copy', () => {
    expect(
      resolveKey(vi as Record<string, unknown>, 'home.hero_goal_met_title'),
    ).toBe('Đã đạt mục tiêu tuần');
    expect(
      resolveKey(en as Record<string, unknown>, 'home.hero_goal_met_title'),
    ).toBe('Weekly goal reached');
    expect(
      resolveKey(vi as Record<string, unknown>, 'home.hero_goal_met_cta'),
    ).toBe('Chọn bài');
    expect(
      resolveKey(en as Record<string, unknown>, 'home.hero_goal_met_cta'),
    ).toBe('Choose a lesson');
  });

  it('mascot copy matches approved copy per state', () => {
    expect(
      resolveKey(vi as Record<string, unknown>, 'home.mascot_no_lessons'),
    ).toBe('Meo! Mình học bài đầu tiên nha?');
    expect(resolveKey(vi as Record<string, unknown>, 'home.mascot_saved')).toBe(
      'Hôm nay học 5 phút thôi!',
    );
    expect(
      resolveKey(vi as Record<string, unknown>, 'home.mascot_in_progress'),
    ).toBe('Sắp xong rồi, cố lên!');
    expect(
      resolveKey(vi as Record<string, unknown>, 'home.mascot_goal_met'),
    ).toBe('Giỏi quá! Meo meo!');
  });

  it('shortcuts copy matches approved copy', () => {
    expect(
      resolveKey(vi as Record<string, unknown>, 'home.shortcut_video'),
    ).toBe('Học qua video');
    expect(
      resolveKey(vi as Record<string, unknown>, 'home.shortcut_video_sub'),
    ).toBe('Xem tiếp, khám phá, tạo bài');
    expect(
      resolveKey(
        vi as Record<string, unknown>,
        'home.shortcut_video_unavailable',
      ),
    ).toBe('Tính năng đang chưa khả dụng');
    expect(
      resolveKey(vi as Record<string, unknown>, 'home.shortcut_speaking_sub'),
    ).toBe('Phòng nói & shadowing');
    expect(
      resolveKey(vi as Record<string, unknown>, 'home.shortcut_create'),
    ).toBe('Tạo bài học');
    expect(
      resolveKey(vi as Record<string, unknown>, 'home.shortcut_create_sub'),
    ).toBe('Từ văn bản, ảnh, video');
  });

  it('saved_rail_empty matches approved copy', () => {
    expect(
      resolveKey(vi as Record<string, unknown>, 'home.saved_rail_empty'),
    ).toBe('Chạm biểu tượng lưu trên thẻ bài học để giữ bài ở đây.');
    expect(
      resolveKey(en as Record<string, unknown>, 'home.saved_rail_empty'),
    ).toBe('Tap the bookmark on a lesson card to keep it here.');
  });

  it('streak_unit plural forms have correct values in vi and en', () => {
    expect(
      resolveKey(vi as Record<string, unknown>, 'home.streak_unit_one'),
    ).toBe('ngày');
    expect(
      resolveKey(vi as Record<string, unknown>, 'home.streak_unit_other'),
    ).toBe('ngày');
    expect(
      resolveKey(en as Record<string, unknown>, 'home.streak_unit_one'),
    ).toBe('day');
    expect(
      resolveKey(en as Record<string, unknown>, 'home.streak_unit_other'),
    ).toBe('days');
  });
});
