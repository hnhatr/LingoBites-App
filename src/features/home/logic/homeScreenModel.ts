/**
 * homeScreenModel — pure presentation logic for Home screen (LING-256, LING-267).
 *
 * Covers:
 * - 5 hero states (DQ-002, P-004): no_lessons, saved_only, in_progress,
 *   youtube_disabled, goal_met
 * - Time-of-day greeting (I5, DQ-008)
 * - Streak flame tiers 0..7+ (I4, P-001, §VS-1.3)
 * - 5-paw weekly goal model (I3, P-004, §VS-3)
 * - Due-flashcard count for review shortcut badge (P-003, §VS-4)
 * - 4-shortcut item configurations (DQ-005, D3, §VS-4)
 * - Saved-rail label (DQ-006, §VS-5)
 * - Graceful degradation when progress percent unavailable (A-009)
 */
import type {LessonCardProgress} from '@ui/components/LessonCard';
import type {HandoffIconName} from '@ui/icons/iconRegistry';

import type {LessonSourceType} from '@core/schemas/lesson';

import type {HomeSvgIconName} from '../components/HomeSvgIcons';

// ---------------------------------------------------------------------------
// Retained & new visual constants (§VS-0)
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
export const HERO_WAVE_SECONDARY = '#3d88c4';

export const HOME_TROPHY = '#d39b00';
export const HOME_EMPTY_PAW = '#d9d6c3';
export const HOME_HEART = '#ff5d7a';
export const HOME_HIGHLIGHT = '#FFD35E';
export const CONFETTI_COLORS = [
  '#FFD35E',
  '#EB6B6C',
  '#6BD2AD',
  '#2dd4bf',
  '#226FAB',
  '#fe7488',
] as const;

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
// Time-of-day greeting (I5, DQ-008, §VS-1.1)
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
  /** Prefix key for two-line greeting, e.g. "Chào buổi sáng," */
  prefixKey:
    | 'home.greeting_morning_prefix'
    | 'home.greeting_afternoon_prefix'
    | 'home.greeting_night_prefix';
  /** Fallback greeting key for single-line greeting without name */
  greetingKey:
    | 'home.greeting_morning'
    | 'home.greeting_afternoon'
    | 'home.greeting_night';
  /** True when displayName is non-null; HomeHeader renders two lines */
  hasName: boolean;
  /** The display name to render on the second accent line, or null */
  displayName: string | null;
  /** Accessible label key */
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
  const prefixMap: Record<
    TimeOfDay,
    | 'home.greeting_morning_prefix'
    | 'home.greeting_afternoon_prefix'
    | 'home.greeting_night_prefix'
  > = {
    morning: 'home.greeting_morning_prefix',
    afternoon: 'home.greeting_afternoon_prefix',
    night: 'home.greeting_night_prefix',
  };
  const greetingKeyMap: Record<
    TimeOfDay,
    'home.greeting_morning' | 'home.greeting_afternoon' | 'home.greeting_night'
  > = {
    morning: 'home.greeting_morning',
    afternoon: 'home.greeting_afternoon',
    night: 'home.greeting_night',
  };

  const prefixKey = prefixMap[timeOfDay];
  const greetingKey = greetingKeyMap[timeOfDay];

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
      prefixKey,
      greetingKey,
      hasName: true,
      displayName,
      a11yKey: namedKeyMap[timeOfDay],
      a11yParams: {name: displayName},
    };
  }

  return {
    timeOfDay,
    prefixKey,
    greetingKey,
    hasName: false,
    displayName: null,
    a11yKey: greetingKey,
    a11yParams: undefined,
  };
}

// ---------------------------------------------------------------------------
// Streak flame tiers (I4, P-001, §VS-1.3)
// ---------------------------------------------------------------------------
/** 7 tiers: 0, 1, 2, 3, 4, 5, 6, 7+ */
export type FlameLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type FlameModel = {
  level: FlameLevel;
  /** Hex color for the flame icon fill */
  color: string;
  /** Size in pt based on flame ladder (16 + 2.3 * level) */
  size: number;
  /** Glow radius in pt (level >= 3 ? (level - 2) * 1.6 : 0) */
  glowRadius: number;
  /** Embers enabled for level >= 7 */
  hasEmbers: boolean;
  /** Accessible label i18n key */
  a11yKey: 'home.streak_days' | 'home.streak_zero';
  a11yParams?: {count: number};
};

export const FLAME_COLORS: Record<FlameLevel, string> = {
  0: '#b9b6a3',
  1: '#ffb03a',
  2: '#ffa133',
  3: '#ff902b',
  4: '#ff7d24',
  5: '#ff6a1f',
  6: '#ff571b',
  7: '#ff4517',
};

export function buildFlameModel(streak: number): FlameModel {
  const clampedStreak = Math.max(0, streak);
  const level = Math.min(7, clampedStreak) as FlameLevel;
  const size = 16 + 2.3 * level;
  const glowRadius = level >= 3 ? (level - 2) * 1.6 : 0;
  const hasEmbers = level >= 7;

  return {
    level,
    color: FLAME_COLORS[level],
    size,
    glowRadius,
    hasEmbers,
    a11yKey: clampedStreak === 0 ? 'home.streak_zero' : 'home.streak_days',
    a11yParams: clampedStreak > 0 ? {count: clampedStreak} : undefined,
  };
}

// ---------------------------------------------------------------------------
// 5-paw weekly goal (I3, P-004, §VS-3)
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
// Shortcut items (DQ-005, D3, P-003, §VS-4)
// Order: video -> review -> speaking -> create
// ---------------------------------------------------------------------------
export type ShortcutKey = 'video' | 'review' | 'speaking' | 'create';

export type ShortcutItem = {
  key: ShortcutKey;
  icon: HomeSvgIconName;
  /** i18n title key */
  titleKey: string;
  /** i18n sub/meta key */
  subKey: string;
  /** Backward-compatible metaKey */
  metaKey: string | null;
  /** metaParams for interpolation */
  metaParams?: Record<string, string | number>;
  testID: string;
  /** Badge count number — null if none */
  badgeCount: number | null;
  /** Badge text (e.g. "99+" or "12") */
  badgeText: string | null;
  /** Whether the shortcut is disabled */
  disabled: boolean;
};

export type ShortcutItemsInput = {
  dueFlashcardCount: number | null;
};

export function buildShortcutItems({
  dueFlashcardCount,
}: ShortcutItemsInput): ShortcutItem[] {
  const hasDue = dueFlashcardCount != null && dueFlashcardCount > 0;
  const reviewSubKey = hasDue
    ? 'home.shortcut_review_due'
    : 'home.shortcut_review_none';
  const badgeText = hasDue
    ? dueFlashcardCount > 99
      ? '99+'
      : String(dueFlashcardCount)
    : null;

  return [
    {
      key: 'video',
      icon: 'play_circle',
      titleKey: 'home.shortcut_video',
      // Always enabled: the video hub lists videos to watch even when
      // creating a lesson from a link is unavailable.
      subKey: 'home.shortcut_video_sub',
      metaKey: 'home.shortcut_video_sub',
      testID: 'home-shortcut-video',
      badgeCount: null,
      badgeText: null,
      disabled: false,
    },
    {
      key: 'review',
      icon: 'style',
      titleKey: 'home.shortcut_review',
      subKey: reviewSubKey,
      metaKey: reviewSubKey,
      metaParams: hasDue ? {count: dueFlashcardCount} : undefined,
      testID: 'home-shortcut-review',
      badgeCount: hasDue ? dueFlashcardCount : null,
      badgeText,
      disabled: false,
    },
    {
      key: 'speaking',
      icon: 'record_voice_over',
      titleKey: 'home.shortcut_speaking',
      subKey: 'home.shortcut_speaking_sub',
      metaKey: 'home.shortcut_speaking_sub',
      testID: 'home-shortcut-speaking',
      badgeCount: null,
      badgeText: null,
      disabled: false,
    },
    {
      key: 'create',
      icon: 'article',
      titleKey: 'home.shortcut_create',
      subKey: 'home.shortcut_create_sub',
      metaKey: 'home.shortcut_create_sub',
      testID: 'home-shortcut-create',
      badgeCount: null,
      badgeText: null,
      disabled: false,
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
  /** Lesson-card fields for the saved rail. */
  sourceType?: LessonSourceType;
  sentenceCount?: number;
  progress?: LessonCardProgress;
  exerciseCount?: number;
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
  /** Weekly count for the diligent badge; defaults to `target`. */
  badgeTarget?: number;
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
  const badgeTarget = input.badgeTarget ?? target;
  const ringPercent = Math.round(
    (Math.min(completedThisWeek, target) / target) * 100,
  );
  const remaining = Math.max(0, target - completedThisWeek);

  let hintKey: WeeklyGoalCardModel['hintKey'];
  let hintParams: WeeklyGoalCardModel['hintParams'];
  if (completedThisWeek >= target) {
    hintKey = 'home.weekly_goal_hint_met';
  } else if (badgeEarned || target !== badgeTarget) {
    // The badge hint only fits when finishing the goal also earns the badge.
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
