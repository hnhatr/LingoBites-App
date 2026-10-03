import type {HandoffIconName} from '@ui/icons/iconRegistry';

import type {LessonSourceType} from '@core/schemas/lesson';

export const RAIL_LIMIT = 3;
export const LINK_HIT_SLOP = {top: 10, bottom: 10, left: 10, right: 10};

export const HERO_BLUE = '#226FAB';
export const HERO_CORAL = '#EB6B6C';
export const HERO_MINT = '#6BD2AD';
export const HERO_BADGE_BG = '#DAF1FA';
export const HERO_BADGE_INK = '#134F7E';
export const HERO_TITLE = '#FFFFFF';
export const HERO_CTA_BG = '#FFD35E';
export const HERO_CTA_INK = '#40320D';

export type ExploreCell = {
  icon: HandoffIconName;
  backgroundKey:
    | 'accentSoft'
    | 'tertiarySoft'
    | 'secondarySoft'
    | 'surfaceContainer';
  inkKey: 'primary' | 'onTertiaryContainer' | 'secondary' | 'text.primary';
  titleKey: string;
  metaKey: string;
  testID: string;
};

export type RecentItem = {
  id: string;
  title: string;
  levelTitle?: string;
  typeLabelKey: string;
  minutes?: number;
  isDownloaded: boolean;
  icon: HandoffIconName;
};

export function typeLabelKeyForSource(sourceType: LessonSourceType): string {
  return sourceType === 'youtube'
    ? 'home.rail_type_video'
    : 'home.rail_type_reading';
}

export function railIconForSource(
  sourceType: LessonSourceType,
): HandoffIconName {
  return sourceType === 'youtube' ? 'play_circle' : 'article';
}

export function trimDisplayName(raw: string | undefined | null): string | null {
  const trimmed = raw?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

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
