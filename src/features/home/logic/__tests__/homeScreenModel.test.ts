/**
 * homeScreenModel unit tests (LING-256, LING-267)
 *
 * Covers:
 * - deriveHeroState: all 6 hero states (DQ-002, P-004)
 * - getTimeOfDay: morning/afternoon/night boundaries (I5, DQ-008)
 * - buildGreeting: prefix keys and named variants
 * - buildFlameModel: tiers 0..7+ (I4, P-001, §VS-1.3)
 * - buildPawGoalModel: one paw per target lesson (I3, P-004, §VS-3)
 * - buildShortcutItems: review badge, video locked, order (DQ-005, D3, P-003, §VS-4)
 * - visual constants (§VS-0)
 */
import {
  buildFlameModel,
  buildGreeting,
  buildPawGoalModel,
  buildShortcutItems,
  buildWeeklyGoalCard,
  CONFETTI_COLORS,
  deriveHeroState,
  FLAME_COLORS,
  getTimeOfDay,
  HERO_WAVE_SECONDARY,
  HOME_EMPTY_PAW,
  HOME_HEART,
  HOME_HIGHLIGHT,
  HOME_TROPHY,
  MAX_PAWS,
} from '../homeScreenModel';

// ---------------------------------------------------------------------------
// Hero state derivation (DQ-002, P-004)
// ---------------------------------------------------------------------------
describe('deriveHeroState (DQ-002, P-004)', () => {
  it('returns goal_met when weekly goal is met (highest priority)', () => {
    expect(
      deriveHeroState({
        downloadCount: 2,
        hasInProgress: true,
        weeklyGoalMet: true,
        youtubeEnabled: true,
      }),
    ).toBe('goal_met');
  });

  it('returns in_progress when a lesson is in progress (no goal)', () => {
    expect(
      deriveHeroState({
        downloadCount: 2,
        hasInProgress: true,
        weeklyGoalMet: false,
        youtubeEnabled: true,
      }),
    ).toBe('in_progress');
  });

  it('returns next_activity when downloads exist and the plan has an open step', () => {
    expect(
      deriveHeroState({
        downloadCount: 3,
        hasInProgress: false,
        hasNextActivity: true,
        weeklyGoalMet: false,
        youtubeEnabled: true,
      }),
    ).toBe('next_activity');
  });

  it('keeps in_progress above next_activity', () => {
    expect(
      deriveHeroState({
        downloadCount: 3,
        hasInProgress: true,
        hasNextActivity: true,
        weeklyGoalMet: false,
        youtubeEnabled: true,
      }),
    ).toBe('in_progress');
  });

  it('keeps the onboarding states when nothing is downloaded', () => {
    expect(
      deriveHeroState({
        downloadCount: 0,
        hasInProgress: false,
        hasNextActivity: true,
        weeklyGoalMet: false,
        youtubeEnabled: true,
      }),
    ).toBe('no_lessons');
  });

  it('returns saved_only when downloads exist but none in progress and the plan is done', () => {
    expect(
      deriveHeroState({
        downloadCount: 3,
        hasInProgress: false,
        weeklyGoalMet: false,
        youtubeEnabled: true,
      }),
    ).toBe('saved_only');
  });

  it('returns youtube_disabled when no downloads and youtube is off', () => {
    expect(
      deriveHeroState({
        downloadCount: 0,
        hasInProgress: false,
        weeklyGoalMet: false,
        youtubeEnabled: false,
      }),
    ).toBe('youtube_disabled');
  });

  it('returns no_lessons when no downloads and youtube is on', () => {
    expect(
      deriveHeroState({
        downloadCount: 0,
        hasInProgress: false,
        weeklyGoalMet: false,
        youtubeEnabled: true,
      }),
    ).toBe('no_lessons');
  });
});

// ---------------------------------------------------------------------------
// Time-of-day (I5, DQ-008)
// ---------------------------------------------------------------------------
describe('getTimeOfDay (I5, DQ-008)', () => {
  it.each([
    [0, 'morning'],
    [5, 'morning'],
    [10, 'morning'],
  ])('hour %i → morning', (hour, expected) => {
    expect(getTimeOfDay(hour)).toBe(expected);
  });

  it.each([
    [11, 'afternoon'],
    [14, 'afternoon'],
    [17, 'afternoon'],
  ])('hour %i → afternoon', (hour, expected) => {
    expect(getTimeOfDay(hour)).toBe(expected);
  });

  it.each([
    [18, 'night'],
    [21, 'night'],
    [23, 'night'],
  ])('hour %i → night', (hour, expected) => {
    expect(getTimeOfDay(hour)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// buildGreeting (I5, DQ-008, §VS-1.1)
// ---------------------------------------------------------------------------
describe('buildGreeting (I5, DQ-008, §VS-1.1)', () => {
  it('returns morning prefix and greeting key for hour < 11 (no name)', () => {
    const model = buildGreeting(8, null);
    expect(model.prefixKey).toBe('home.greeting_morning_prefix');
    expect(model.greetingKey).toBe('home.greeting_morning');
    expect(model.timeOfDay).toBe('morning');
    expect(model.hasName).toBe(false);
    expect(model.displayName).toBeNull();
    expect(model.a11yKey).toBe('home.greeting_morning');
    expect(model.a11yParams).toBeUndefined();
  });

  it('returns afternoon prefix + two-line mode when displayName is provided', () => {
    const model = buildGreeting(14, 'An');
    expect(model.prefixKey).toBe('home.greeting_afternoon_prefix');
    expect(model.hasName).toBe(true);
    expect(model.displayName).toBe('An');
    expect(model.a11yKey).toBe('home.greeting_afternoon_named');
    expect(model.a11yParams).toEqual({name: 'An'});
  });

  it('returns night prefix + two-line mode for hour >= 18 with name', () => {
    const model = buildGreeting(22, 'Bình');
    expect(model.prefixKey).toBe('home.greeting_night_prefix');
    expect(model.hasName).toBe(true);
    expect(model.displayName).toBe('Bình');
    expect(model.a11yKey).toBe('home.greeting_night_named');
    expect(model.a11yParams).toEqual({name: 'Bình'});
  });
});

// ---------------------------------------------------------------------------
// buildFlameModel — streak tiers 0..7+ (I4, P-001, §VS-1.3)
// ---------------------------------------------------------------------------
describe('buildFlameModel (I4, P-001, §VS-1.3)', () => {
  it('returns level 0, size 16, no glow, no embers, and streak_zero for streak 0', () => {
    const m = buildFlameModel(0);
    expect(m.level).toBe(0);
    expect(m.color).toBe('#b9b6a3');
    expect(m.size).toBe(16);
    expect(m.glowRadius).toBe(0);
    expect(m.hasEmbers).toBe(false);
    expect(m.a11yKey).toBe('home.streak_zero');
    expect(m.a11yParams).toBeUndefined();
  });

  it.each([1, 2, 3, 4, 5, 6])(
    'streak %i maps to level %i with correct size and color',
    streak => {
      const m = buildFlameModel(streak);
      expect(m.level).toBe(streak);
      expect(m.color).toBe(FLAME_COLORS[streak as keyof typeof FLAME_COLORS]);
      expect(m.size).toBeCloseTo(16 + 2.3 * streak, 2);
      expect(m.glowRadius).toBe(streak >= 3 ? (streak - 2) * 1.6 : 0);
      expect(m.hasEmbers).toBe(false);
      expect(m.a11yKey).toBe('home.streak_days');
      expect(m.a11yParams).toEqual({count: streak});
    },
  );

  it('clamps streak >= 7 to level 7 with embers enabled', () => {
    const m7 = buildFlameModel(7);
    expect(m7.level).toBe(7);
    expect(m7.color).toBe('#ff4517');
    expect(m7.size).toBeCloseTo(32.1, 1);
    expect(m7.glowRadius).toBeCloseTo(8.0, 1);
    expect(m7.hasEmbers).toBe(true);

    const m30 = buildFlameModel(30);
    expect(m30.level).toBe(7);
    expect(m30.hasEmbers).toBe(true);
    expect(m30.a11yParams).toEqual({count: 30});
  });

  it('each tier has a distinct color matching §VS-1.3', () => {
    const expected = [
      '#b9b6a3',
      '#ffb03a',
      '#ffa133',
      '#ff902b',
      '#ff7d24',
      '#ff6a1f',
      '#ff571b',
      '#ff4517',
    ];
    for (let i = 0; i <= 7; i++) {
      expect(buildFlameModel(i).color).toBe(expected[i]);
    }
  });
});

// ---------------------------------------------------------------------------
// buildPawGoalModel — one paw per target lesson (I3, P-004, §VS-3)
// ---------------------------------------------------------------------------
describe('buildPawGoalModel (I3, P-004, §VS-3)', () => {
  it('draws one paw per lesson of the target', () => {
    expect(buildPawGoalModel(0, 3).totalPaws).toBe(3);
    expect(buildPawGoalModel(0, 5).totalPaws).toBe(5);
    expect(buildPawGoalModel(0, 6).totalPaws).toBe(6);
    expect(buildPawGoalModel(0, 7).totalPaws).toBe(7);
  });

  it('fills exactly one paw per completed lesson', () => {
    const m = buildPawGoalModel(3, 6);
    expect(m.filledPaws).toBe(3);
    expect(m.goalMet).toBe(false);
  });

  it('fills every paw when the goal is met (6/6)', () => {
    const m = buildPawGoalModel(6, 6);
    expect(m.filledPaws).toBe(6);
    expect(m.goalMet).toBe(true);
  });

  it('returns 0 filled paws when nothing is completed', () => {
    const m = buildPawGoalModel(0, 6);
    expect(m.filledPaws).toBe(0);
    expect(m.goalMet).toBe(false);
  });

  it('caps filledPaws at the target when completedThisWeek > target', () => {
    const m = buildPawGoalModel(10, 6);
    expect(m.filledPaws).toBe(6);
    expect(m.goalMet).toBe(true);
  });

  it('clamps the paw row for out-of-range targets', () => {
    expect(buildPawGoalModel(0, 0).totalPaws).toBe(1);
    expect(buildPawGoalModel(0, 50).totalPaws).toBe(MAX_PAWS);
  });
});

// ---------------------------------------------------------------------------
// buildShortcutItems — 4 shortcuts in §VS-4 order (video, review, speaking, create)
// ---------------------------------------------------------------------------
describe('buildShortcutItems (§VS-4, DQ-005, D3, P-003)', () => {
  it('returns exactly 4 shortcuts in specified order: video, review, speaking, create', () => {
    const items = buildShortcutItems({
      dueFlashcardCount: 0,
    });
    expect(items).toHaveLength(4);
    expect(items.map(i => i.key)).toEqual([
      'video',
      'review',
      'speaking',
      'create',
    ]);
  });

  it('review shortcut has badge and badgeText when dueFlashcardCount > 0', () => {
    const items = buildShortcutItems({
      dueFlashcardCount: 12,
    });
    const review = items.find(i => i.key === 'review');
    expect(review?.badgeCount).toBe(12);
    expect(review?.badgeText).toBe('12');
    expect(review?.subKey).toBe('home.shortcut_review_due');
  });

  it('review shortcut caps badgeText at 99+ when dueFlashcardCount > 99 (EC-005)', () => {
    const items = buildShortcutItems({
      dueFlashcardCount: 150,
    });
    const review = items.find(i => i.key === 'review');
    expect(review?.badgeCount).toBe(150);
    expect(review?.badgeText).toBe('99+');
  });

  it('review shortcut has no badge when dueFlashcardCount is 0 or null', () => {
    const items0 = buildShortcutItems({
      dueFlashcardCount: 0,
    });
    const review0 = items0.find(i => i.key === 'review');
    expect(review0?.badgeCount).toBeNull();
    expect(review0?.badgeText).toBeNull();
    expect(review0?.subKey).toBe('home.shortcut_review_none');

    const itemsNull = buildShortcutItems({
      dueFlashcardCount: null,
    });
    const reviewNull = itemsNull.find(i => i.key === 'review');
    expect(reviewNull?.badgeCount).toBeNull();
  });

  it('video shortcut is always enabled and opens the video hub sub-line', () => {
    const items = buildShortcutItems({
      dueFlashcardCount: 0,
    });
    const video = items.find(i => i.key === 'video');
    expect(video?.disabled).toBe(false);
    expect(video?.subKey).toBe('home.shortcut_video_sub');
  });
});

// ---------------------------------------------------------------------------
// Visual constants (§VS-0)
// ---------------------------------------------------------------------------
describe('Visual constants (§VS-0)', () => {
  it('exports required mockup v4 theme and local color constants', () => {
    expect(HOME_TROPHY).toBe('#d39b00');
    expect(HOME_EMPTY_PAW).toBe('#d9d6c3');
    expect(HOME_HEART).toBe('#ff5d7a');
    expect(HOME_HIGHLIGHT).toBe('#FFD35E');
    expect(HERO_WAVE_SECONDARY).toBe('#3d88c4');
    expect(CONFETTI_COLORS).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// buildWeeklyGoalCard — preserved from original model (backward compat)
// ---------------------------------------------------------------------------
describe('buildWeeklyGoalCard (backward compat)', () => {
  it('computes ring percent and badge hint when earned is false', () => {
    const m = buildWeeklyGoalCard({
      completedThisWeek: 4,
      target: 6,
      badgeEarned: false,
    });
    expect(m.ringPercent).toBe(67);
    expect(m.hintKey).toBe('home.weekly_goal_hint_badge');
    expect(m.hintParams).toEqual({k: 2});
  });

  it('returns met hint when completedThisWeek >= target', () => {
    const m = buildWeeklyGoalCard({
      completedThisWeek: 6,
      target: 6,
      badgeEarned: true,
    });
    expect(m.hintKey).toBe('home.weekly_goal_hint_met');
  });
});

describe('buildWeeklyGoalCard with a custom goal (F6)', () => {
  it('only promises the badge when the goal equals the badge threshold', () => {
    const custom = buildWeeklyGoalCard({
      completedThisWeek: 1,
      target: 3,
      badgeEarned: false,
      badgeTarget: 6,
    });
    expect(custom.hintKey).toBe('home.weekly_goal_hint_kept');
    expect(custom.hintParams).toEqual({k: 2});

    const lastOne = buildWeeklyGoalCard({
      completedThisWeek: 2,
      target: 3,
      badgeEarned: false,
      badgeTarget: 6,
    });
    expect(lastOne.hintKey).toBe('home.weekly_goal_hint_last');
    expect(lastOne.hintParams).toBeUndefined();

    const matching = buildWeeklyGoalCard({
      completedThisWeek: 1,
      target: 6,
      badgeEarned: false,
      badgeTarget: 6,
    });
    expect(matching.hintKey).toBe('home.weekly_goal_hint_badge');
  });
});
