/**
 * Navigation contracts for app shell navigation and navigation primitives.
 * Established in TASK-002 (AD-004 foundation), populated in TASK-003.
 */

export type ShellRouteNames =
  | 'Tabs'
  | 'YouTubeHistory'
  | 'YouTubeLesson'
  | 'Practice'
  | 'BootGate'
  | 'Onboarding';

export type TabRouteNames =
  | 'Home'
  | 'Create'
  | 'Lessons'
  | 'Profile'
  | 'Review'
  | 'Settings';

export type RootTabRouteNames = 'Home' | 'Create' | 'Lessons' | 'Profile';

export type RootStackRouteNames = ShellRouteNames;

export type NavigationContract = {
  shellRoutes: ShellRouteNames;
  tabRoutes: TabRouteNames;
};

/**
 * Shared navigation primitives for feature screens and shell navigators.
 */
export interface NavigationBackHandle {
  goBack: () => void;
  canGoBack?: () => boolean;
}

export interface ScreenNavigationProp<TRouteNames extends string = string> {
  goBack: () => void;
  canGoBack?: () => boolean;
  navigate: (screen: TRouteNames, params?: unknown) => void;
  reset: (state: unknown) => void;
  replace?: (screen: TRouteNames, params?: unknown) => void;
  setParams?: (params: unknown) => void;
  getParent: <TParent = unknown>(id?: string) => TParent;
  addListener: (event: string, callback: (event: any) => void) => () => void;
  dispatch?: (action: unknown) => void;
  setOptions?: (options: Record<string, unknown>) => void;
}

export interface ScreenRouteProp<TParams> {
  key?: string;
  name?: string;
  params: TParams;
}

export interface ScreenProps<
  TParams = undefined,
  TRouteNames extends string = string,
> {
  navigation: ScreenNavigationProp<TRouteNames>;
  route: ScreenRouteProp<TParams>;
}
