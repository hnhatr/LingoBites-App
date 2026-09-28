import type {HandoffIconName} from '@ui/icons/iconRegistry';
import type {ContentLessonRow} from '@features/lesson/packages';
import type {UnifiedLessonSummary} from '@features/lesson/player';

export const RECENT_LIMIT = 3;
export const SUGGESTION_LIMIT = 3;
export const UNIFIED_RAIL_LIMIT = RECENT_LIMIT + SUGGESTION_LIMIT;
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
  badgeKey?: string;
  badgeParams?: Record<string, string | number>;
  tagKey?: string;
};

export type RecentItem = {
  kind: 'personal' | 'packaged' | 'canonical';
  id: string;
  title: string;
  meta: string;
  level?: string;
};

export type RelearnTarget = {
  kind: 'personal' | 'packaged';
  id: string;
  title: string;
  level: string;
};

export function toCanonicalRecentItem(item: UnifiedLessonSummary): RecentItem {
  return {
    kind: 'canonical',
    id: item.id,
    title: item.title,
    meta:
      item.estimatedMinutes != null
        ? `${item.estimatedMinutes} phút`
        : item.description ?? '',
  };
}

export type HomeScreenStarterState = {
  showStarter: boolean;
  starterBare: boolean;
  heroPick: boolean;
  libraryCount: number | null;
  relearnTarget: RelearnTarget | null;
};

export type HomeScreenHeroState = {
  startedLesson: ContentLessonRow | null;
};
