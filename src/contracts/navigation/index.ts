/**
 * Navigation contracts for app shell navigation.
 * Established in TASK-002 (AD-004 foundation), populated in TASK-003.
 */

export type ShellRouteNames =
  | 'Tabs'
  | 'YouTubeHistory'
  | 'YouTubeLesson'
  | 'Practice';

export type TabRouteNames =
  | 'Home'
  | 'Create'
  | 'Lessons'
  | 'Review'
  | 'Settings';

export type NavigationContract = {
  shellRoutes: ShellRouteNames;
  tabRoutes: TabRouteNames;
};
