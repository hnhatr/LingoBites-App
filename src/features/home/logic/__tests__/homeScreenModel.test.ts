/**
 * homeScreenModel unit tests (LING-256 TASK-002)
 *
 * Covers:
 * - deriveHeroState: all 5 hero states (DQ-002, P-004)
 * - getTimeOfDay: morning/afternoon/night boundaries (I5, DQ-008)
 * - buildGreeting: keys and named variants
 * - buildFlameModel: tiers 0..7+ (I4, P-001)
 * - buildPawGoalModel: filled paw count (I3, P-004)
 * - buildShortcutItems: review badge, video locked (DQ-005, D3, P-003)
 */
import {
  buildFlameModel,
  buildGreeting,
  buildPawGoalModel,
  buildShortcutItems,
  buildWeeklyGoalCard,
  deriveHeroState,
  getTimeOfDay,
  HERO_WAVE_SECONDARY,
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

  it('returns saved_only when downloads exist but none in progress', () => {
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
// buildGreeting (I5, DQ-008) — Gap 3 fix: two-line mode + _named a11y keys
// ---------------------------------------------------------------------------
describe('buildGreeting (I5, DQ-008)', () => {
  it('returns morning greeting key for hour < 11 (no name)', () => {
    const model = buildGreeting(8, null);
    expect(model.greetingKey).toBe('home.greeting_morning');
    expect(model.timeOfDay).toBe('morning');
    expect(model.hasName).toBe(false);
    expect(model.displayName).toBeNull();
    expect(model.a11yKey).toBe('home.greeting_morning');
    expect(model.a11yParams).toBeUndefined();
  });

  it('returns afternoon key + two-line mode when displayName is provided', () => {
    const model = buildGreeting(14, 'An');
    // greetingKey stays unnamed (used for the small prefix line)
    expect(model.greetingKey).toBe('home.greeting_afternoon');
    expect(model.hasName).toBe(true);
    expect(model.displayName).toBe('An');
    // a11y key is the _named variant
    expect(model.a11yKey).toBe('home.greeting_afternoon_named');
    expect(model.a11yParams).toEqual({name: 'An'});
  });

  it('returns night greeting key + two-line mode for hour >= 18 with name', () => {
    const model = buildGreeting(22, 'Bình');
    expect(model.greetingKey).toBe('home.greeting_night');
    expect(model.hasName).toBe(true);
    expect(model.displayName).toBe('Bình');
    expect(model.a11yKey).toBe('home.greeting_night_named');
    expect(model.a11yParams).toEqual({name: 'Bình'});
  });
});

// ---------------------------------------------------------------------------
// buildFlameModel — streak tiers 0..7+ (I4, P-001)
// ---------------------------------------------------------------------------
describe('buildFlameModel (I4, P-001)', () => {
  it('returns level 0 and streak_zero key for streak 0', () => {
    const m = buildFlameModel(0);
    expect(m.level).toBe(0);
    expect(m.a11yKey).toBe('home.streak_zero');
    expect(m.a11yParams).toBeUndefined();
  });

  it.each([1, 2, 3, 4, 5, 6])('streak %i maps to level %i', streak => {
    const m = buildFlameModel(streak);
    expect(m.level).toBe(streak);
    expect(m.a11yKey).toBe('home.streak_days');
    expect(m.a11yParams).toEqual({count: streak});
  });

  it('clamps streak >= 7 to level 7 (legendary)', () => {
    expect(buildFlameModel(7).level).toBe(7);
    expect(buildFlameModel(30).level).toBe(7);
    expect(buildFlameModel(365).level).toBe(7);
  });

  it('each tier has a distinct color', () => {
    const colors = Array.from({length: 8}, (_, i) => buildFlameModel(i).color);
    const unique = new Set(colors);
    expect(unique.size).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// buildPawGoalModel — 5-paw weekly goal (I3, P-004)
// ---------------------------------------------------------------------------
describe('buildPawGoalModel (I3, P-004)', () => {
  it('returns 5 filled paws when goal is met (6/6)', () => {
    const m = buildPawGoalModel(6, 6);
    expect(m.filledPaws).toBe(5);
    expect(m.totalPaws).toBe(5);
    expect(m.goalMet).toBe(true);
  });

  it('returns 0 filled paws when nothing is completed', () => {
    const m = buildPawGoalModel(0, 6);
    expect(m.filledPaws).toBe(0);
    expect(m.goalMet).toBe(false);
  });

  it('returns totalPaws always 5', () => {
    expect(buildPawGoalModel(3, 6).totalPaws).toBe(5);
  });

  it('caps filledPaws at 5 even if completedThisWeek > target', () => {
    const m = buildPawGoalModel(10, 6);
    expect(m.filledPaws).toBeLessThanOrEqual(5);
    expect(m.goalMet).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildShortcutItems — 4 shortcuts (DQ-005, D3, P-003)
// ---------------------------------------------------------------------------
describe('buildShortcutItems (DQ-005, D3, P-003)', () => {
  it('returns exactly 4 shortcuts', () => {
    const items = buildShortcutItems({
      dueFlashcardCount: 0,
      youtubeEnabled: true,
    });
    expect(items).toHaveLength(4);
  });

  it('review shortcut has badge when dueFlashcardCount > 0', () => {
    const items = buildShortcutItems({
      dueFlashcardCount: 5,
      youtubeEnabled: true,
    });
    const review = items.find(i => i.key === 'review');
    expect(review?.badgeCount).toBe(5);
  });

  it('review shortcut has no badge when dueFlashcardCount is 0', () => {
    const items = buildShortcutItems({
      dueFlashcardCount: 0,
      youtubeEnabled: true,
    });
    const review = items.find(i => i.key === 'review');
    expect(review?.badgeCount).toBeNull();
  });

  it('review shortcut has no badge when dueFlashcardCount is null', () => {
    const items = buildShortcutItems({
      dueFlashcardCount: null,
      youtubeEnabled: true,
    });
    const review = items.find(i => i.key === 'review');
    expect(review?.badgeCount).toBeNull();
  });

  it('video shortcut is disabled when youtubeEnabled is false (D3)', () => {
    const items = buildShortcutItems({
      dueFlashcardCount: 0,
      youtubeEnabled: false,
    });
    const video = items.find(i => i.key === 'video');
    expect(video?.disabled).toBe(true);
  });

  it('video shortcut is enabled when youtubeEnabled is true', () => {
    const items = buildShortcutItems({
      dueFlashcardCount: 0,
      youtubeEnabled: true,
    });
    const video = items.find(i => i.key === 'video');
    expect(video?.disabled).toBe(false);
  });

  it('other shortcuts are never disabled', () => {
    const items = buildShortcutItems({
      dueFlashcardCount: 0,
      youtubeEnabled: false,
    });
    const nonVideo = items.filter(i => i.key !== 'video');
    for (const item of nonVideo) {
      expect(item.disabled).toBe(false);
    }
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

// ---------------------------------------------------------------------------
// CR-002 (LING-264): HERO_WAVE_SECONDARY exported constant
// ---------------------------------------------------------------------------
describe('HERO_WAVE_SECONDARY (CR-002, LING-264)', () => {
  it('is exported with value #3d88c4', () => {
    expect(HERO_WAVE_SECONDARY).toBe('#3d88c4');
  });

  it('is a valid hex colour string', () => {
    expect(/^#[0-9a-fA-F]{6}$/.test(HERO_WAVE_SECONDARY)).toBe(true);
  });
});
