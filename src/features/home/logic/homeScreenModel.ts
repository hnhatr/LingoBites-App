/**
 * homeScreenModel — pure presentation logic for Home screen (LING-256).
 *
 * Covers:
 * - 5 hero states (DQ-002, P-004): no_lessons, saved_only, in_progress,
 *   youtube_disabled, goal_met
 * - Time-of-day greeting (I5, DQ-008)
 * - Streak flame tiers 0..7+ (I4, P-001)
 * - 5-paw weekly goal model (I3, P-004)
 * - Due-flashcard count for review shortcut badge (P-003)
 * - 4-shortcut item configurations (DQ-005, D3)
 * - Saved-rail label (DQ-006)
 * - Graceful degradation when progress percent unavailable (A-009)
 */
import type {HandoffIconName} from '@ui/icons/iconRegistry';

import type {LessonSourceType} from '@core/schemas/lesson';

// ---------------------------------------------------------------------------
// Retained constants (used in HomeScreenView legacy + new components)
// ---------------------------------------------------------------------------
export const RAIL_LIMIT = 3;
export const LINK_HIT_SLOP = {top: 10, bottom: 10, left: 10, right: 10};

export const HERO_BLUE = '#226FAB';
export const HERO_CORAL = '#EB6B6C';
export const HERO_MINT = '#6BD2AD';
export const HERO_BADGE_BG = '#DAF1BA';
export const HERO_BADGE_INK = '#134F7E';
export const HERO_TITLE = '#FFFFFF';
export const HERO_CTA_BG = '#FFD35E';
export const HERO_CTA_INK = '#40320D';

// ---------------------------------------------------------------------------
// Hero states (DQ-002, P-004)
// ---------------------------------------------------------------------------
/**
 * Five deterministic hero states derived from local SQLite + store state.
 *
 * State precedence (highest first):
 * 1. goal_met     — weekly goal is completed (completedThisWeek >= target)
 * 2. in_progress  — a downloaded lesson is in progress
 * 3. youtube_disabled — YouTube flag is off and user has no downloads
 * 4. saved_only   — downloads exist but none in progress
 * 5. no_lessons   — no downloads at all
 */
export type HeroState =
  | 'no_lessons'
  | 'saved_only'
  | 'in_progress'
  | 'youtube_disabled'
  | 'goal_met';

export type HeroStateInput = {
  downloadCount: number;
  hasInProgress: boolean;
  weeklyGoalMet: boolean;
  youtubeEnabled: boolean;
};

export function deriveHeroState({
  downloadCount,
  hasInProgress,
  weeklyGoalMet,
  youtubeEnabled,
}: HeroStateInput): HeroState {
  if (weeklyGoalMet) return 'goal_met';
  if (hasInProgress) return 'in_progress';
  if (downloadCount > 0) return 'saved_only';
  if (!youtubeEnabled) return 'youtube_disabled';
  return 'no_lessons';
}

// ---------------------------------------------------------------------------
// Time-of-day greeting (I5, DQ-008)
// ---------------------------------------------------------------------------
export type TimeOfDay = 'morning' | 'afternoon' | 'night';

/** Returns the time-of-day period based on the local hour (0-23). */
export function getTimeOfDay(hour: number): TimeOfDay {
  if (hour < 11) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'night';
}

export type GreetingModel = {
  timeOfDay: TimeOfDay;
  /**
   * i18n key for the greeting line.
   *
   * The unnamed keys (greeting_morning/afternoon/night) contain no `{{name}}`
   * placeholder — they render as plain strings like "Chào buổi sáng!".
   * When hasName is true, this key is used for the small prefix line and
   * displayName is shown on a separate large accent line below.
   * When hasName is false, this key is displayed as a single-line greeting.
   * The `_named` variants (a11yKey) carry `{{name}}` for the a11y path only.
   */
  greetingKey:
    | 'home.greeting_morning'
    | 'home.greeting_afternoon'
    | 'home.greeting_night';
  /** True when displayName is non-null; HomeHeader renders two lines */
  hasName: boolean;
  /** The display name to render on the second accent line, or null */
  displayName: string | null;
  /**
   * Accessible label key (the _named variant when name exists, so screen
   * readers read the full greeting with the name).
   */
  a11yKey:
    | 'home.greeting_morning'
    | 'home.greeting_afternoon'
    | 'home.greeting_night'
    | 'home.greeting_morning_named'
    | 'home.greeting_afternoon_named'
    | 'home.greeting_night_named';
  a11yParams?: {name: string};
};

export function buildGreeting(
  hour: number,
  displayName: string | null,
): GreetingModel {
  const timeOfDay = getTimeOfDay(hour);
  const keyMap: Record<
    TimeOfDay,
    'home.greeting_morning' | 'home.greeting_afternoon' | 'home.greeting_night'
  > = {
    morning: 'home.greeting_morning',
    afternoon: 'home.greeting_afternoon',
    night: 'home.greeting_night',
  };
  const greetingKey = keyMap[timeOfDay];

  if (displayName) {
    const namedKeyMap: Record<
      TimeOfDay,
      | 'home.greeting_morning_named'
      | 'home.greeting_afternoon_named'
      | 'home.greeting_night_named'
    > = {
      morning: 'home.greeting_morning_named',
      afternoon: 'home.greeting_afternoon_named',
      night: 'home.greeting_night_named',
    };
    return {
      timeOfDay,
      greetingKey,
      hasName: true,
      displayName,
      a11yKey: namedKeyMap[timeOfDay],
      a11yParams: {name: displayName},
    };
  }

  return {
    timeOfDay,
    greetingKey,
    hasName: false,
    displayName: null,
    a11yKey: greetingKey,
    a11yParams: undefined,
  };
}

// ---------------------------------------------------------------------------
// Streak flame tiers (I4, P-001)
// ---------------------------------------------------------------------------
/** 7 tiers: 0, 1, 2, 3, 4, 5, 6, 7+ */
export type FlameLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type FlameModel = {
  level: FlameLevel;
  /** Hex color for the flame icon fill */
  color: string;
  /** Accessible label i18n key */
  a11yKey: 'home.streak_days' | 'home.streak_zero';
  a11yParams?: {count: number};
};

// Colors progress warm-to-hot across tiers.
const FLAME_COLORS: Record<FlameLevel, string> = {
  0: '#B0BEC5', // grey — no streak
  1: '#FFB74D', // amber
  2: '#FFA726', // deep amber
  3: '#FF7043', // deep orange
  4: '#F4511E', // orange-red
  5: '#E53935', // red
  6: '#C62828', // deep red
  7: '#7B1FA2', // purple (legendary)
};

export function buildFlameModel(streak: number): FlameModel {
  const level = Math.min(7, streak) as FlameLevel;
  return {
    level,
    color: FLAME_COLORS[level],
    a11yKey: streak === 0 ? 'home.streak_zero' : 'home.streak_days',
    a11yParams: streak > 0 ? {count: streak} : undefined,
  };
}

// ---------------------------------------------------------------------------
// 5-paw weekly goal (I3, P-004)
// ---------------------------------------------------------------------------
export const PAW_COUNT = 5;

export type PawGoalModel = {
  /** How many paws are filled (0-5) */
  filledPaws: number;
  /** Total paws always 5 */
  totalPaws: 5;
  /** True when all 5 paws are filled */
  goalMet: boolean;
};

export function buildPawGoalModel(
  completedThisWeek: number,
  target: number,
): PawGoalModel {
  const perPaw = Math.max(1, target / PAW_COUNT);
  const filledPaws = Math.min(
    PAW_COUNT,
    Math.floor(completedThisWeek / perPaw),
  );
  return {
    filledPaws,
    totalPaws: 5,
    goalMet: completedThisWeek >= target,
  };
}

// ---------------------------------------------------------------------------
// Shortcut items (DQ-005, D3, P-003)
// ---------------------------------------------------------------------------
export type ShortcutKey = 'review' | 'speaking' | 'lessons' | 'video';

export type ShortcutItem = {
  key: ShortcutKey;
  /** i18n title key */
  titleKey: string;
  /** i18n meta/subtitle key — null if no meta */
  metaKey: string | null;
  /** metaKey interpolation params */
  metaParams?: Record<string, string | number>;
  testID: string;
  /** Badge count — shown when > 0 */
  badgeCount: number | null;
  /** Whether the shortcut is locked/disabled */
  disabled: boolean;
};

export type ShortcutItemsInput = {
  dueFlashcardCount: number | null;
  youtubeEnabled: boolean;
};

export function buildShortcutItems({
  dueFlashcardCount,
  youtubeEnabled,
}: ShortcutItemsInput): ShortcutItem[] {
  return [
    {
      key: 'review',
      titleKey: 'home.shortcut_review',
      metaKey:
        dueFlashcardCount != null && dueFlashcardCount > 0
          ? 'home.shortcut_review_meta'
          : null,
      metaParams:
        dueFlashcardCount != null && dueFlashcardCount > 0
          ? {count: dueFlashcardCount}
          : undefined,
      testID: 'home-shortcut-review',
      badgeCount:
        dueFlashcardCount != null && dueFlashcardCount > 0
          ? dueFlashcardCount
          : null,
      disabled: false,
    },
    {
      key: 'speaking',
      titleKey: 'home.shortcut_speaking',
      metaKey: 'home.shortcut_speaking_meta',
      testID: 'home-shortcut-speaking',
      badgeCount: null,
      disabled: false,
    },
    {
      key: 'lessons',
      titleKey: 'home.shortcut_lessons',
      metaKey: null,
      testID: 'home-shortcut-lessons',
      badgeCount: null,
      disabled: false,
    },
    {
      key: 'video',
      titleKey: 'home.shortcut_video',
      metaKey: youtubeEnabled ? null : 'home.shortcut_video_locked',
      testID: 'home-shortcut-video',
      badgeCount: null,
      disabled: !youtubeEnabled,
    },
  ];
}

// ---------------------------------------------------------------------------
// Rail item types (preserved from original model)
// ---------------------------------------------------------------------------
export type RecentItem = {
  id: string;
  title: string;
  levelTitle?: string;
  typeLabelKey: string;
  minutes?: number;
  isDownloaded: boolean;
  /** HandoffIconName for the legacy HomeScreenView rail (retained for view compatibility) */
  icon: HandoffIconName;
};

export function typeLabelKeyForSource(sourceType: LessonSourceType): string {
  return sourceType === 'youtube'
    ? 'home.rail_type_video'
    : 'home.rail_type_reading';
}

export function trimDisplayName(raw: string | undefined | null): string | null {
  const trimmed = raw?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

// ---------------------------------------------------------------------------
// Weekly goal card model (preserved for backward compatibility with existing tests)
// ---------------------------------------------------------------------------
export type WeeklyGoalCardInput = {
  completedThisWeek: number;
  target: number;
  badgeEarned: boolean;
};

export type WeeklyGoalCardModel = {
  completedThisWeek: number;
  target: number;
  ringPercent: number;
  countLineKey: 'home.weekly_goal_line';
  countLineParams: {n: number; target: number};
  hintKey:
    | 'home.weekly_goal_hint_badge'
    | 'home.weekly_goal_hint_met'
    | 'home.weekly_goal_hint_kept';
  hintParams?: {k: number};
};

/** Pure weekly-goal card presentation (LING-222 AD-003 / FR-002…FR-004). */
export function buildWeeklyGoalCard(
  input: WeeklyGoalCardInput,
): WeeklyGoalCardModel {
  const {completedThisWeek, target, badgeEarned} = input;
  const ringPercent = Math.round(
    (Math.min(completedThisWeek, target) / target) * 100,
  );
  const remaining = Math.max(0, target - completedThisWeek);

  let hintKey: WeeklyGoalCardModel['hintKey'];
  let hintParams: WeeklyGoalCardModel['hintParams'];
  if (completedThisWeek >= target) {
    hintKey = 'home.weekly_goal_hint_met';
  } else if (badgeEarned) {
    hintKey = 'home.weekly_goal_hint_kept';
    hintParams = {k: remaining};
  } else {
    hintKey = 'home.weekly_goal_hint_badge';
    hintParams = {k: remaining};
  }

  return {
    completedThisWeek,
    target,
    ringPercent,
    countLineKey: 'home.weekly_goal_line',
    countLineParams: {n: completedThisWeek, target},
    hintKey,
    hintParams,
  };
}

export function railIconForSource(
  _sourceType: LessonSourceType,
): HandoffIconName {
  return _sourceType === 'youtube' ? 'play_circle' : 'article';
}
