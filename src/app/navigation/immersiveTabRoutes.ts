import type {ParamListBase, RouteProp} from '@react-navigation/native';
import {getFocusedRouteNameFromRoute} from '@react-navigation/native';

export const IMMERSIVE_STACK_ROUTES = new Set([
  'ContentLessonRuntime',
  'CurriculumLesson',
  'DailyReview',
  'SpeakingRoom',
  'SpeakingShadowing',
  'YouTubeInput',
  'YouTubeLesson',
  'YouTubeProcessing',
]);

export function shouldHideTabBarForRouteName(
  routeName: string | undefined,
): boolean {
  if (!routeName) {
    return false;
  }
  return IMMERSIVE_STACK_ROUTES.has(routeName);
}

export function shouldHideTabBarForStackRoute(
  route: Partial<RouteProp<ParamListBase>>,
): boolean {
  return shouldHideTabBarForRouteName(getFocusedRouteNameFromRoute(route));
}

export function tabBarVisibilityOptions({
  route,
}: {
  route: Partial<RouteProp<ParamListBase>>;
}) {
  const hidden = shouldHideTabBarForStackRoute(route);
  return {
    tabBarStyle: hidden
      ? {display: 'none' as const}
      : {display: 'flex' as const},
  };
}

export function isTabBarHiddenForDescriptors(
  state: {index: number; routes: Array<{key: string}>},
  descriptors: Record<string, {options?: {tabBarStyle?: unknown}}>,
): boolean {
  const focusedKey = state.routes[state.index]?.key;
  if (!focusedKey) {
    return false;
  }
  const style = descriptors[focusedKey]?.options?.tabBarStyle as
    | {display?: unknown}
    | undefined;
  return style?.display === 'none';
}
