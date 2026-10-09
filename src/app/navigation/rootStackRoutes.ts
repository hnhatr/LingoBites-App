import type {FeatureKey} from '@core/release';

import {isIngestionRouteEnabled} from './ingestionRouteGate';
import type {RootStackParamList} from './types';

type RootRouteName = Extract<keyof RootStackParamList, string>;

/** Root-stack task flows, each registered exactly once (see AppNavigator). */
export const ROOT_FLOW_ROUTES = [
  'CreateHub',
  'LessonCreation',
  'CanonicalCatalog',
  'CanonicalLessonPlayer',
  'LibraryList',
  'VideoHub',
  'CourseLevels',
  'LevelUnits',
  'UnitLessons',
  'DailyReview',
  'ItemReview',
  'Practice',
  'Today',
  'SpeakingRoom',
  'ShadowingLessonPicker',
  'ShadowingSession',
  'ShadowingSummary',
] as const satisfies readonly RootRouteName[];

/** Create-flow input screens, mounted only when their feature chain is on. */
export const ROOT_INGESTION_ROUTES = [
  'PasteText',
  'ImageCapture',
  'OCRReview',
] as const satisfies readonly RootRouteName[];

/** Root routes mounted for an authenticated session with these flags. */
export function getRootStackRouteNames(
  features: Partial<Record<FeatureKey, boolean>> = {},
): RootRouteName[] {
  return [
    'Tabs',
    ...ROOT_INGESTION_ROUTES.filter(route =>
      isIngestionRouteEnabled(route, features),
    ),
    ...ROOT_FLOW_ROUTES,
  ];
}
