/**
 * Navigation contracts for app shell navigation and navigation primitives.
 * Established in TASK-002 (AD-004 foundation), populated in TASK-003.
 */

import type {NavigateFn, ParamListBase, ReplaceFn} from './paramList';

export type {NavigateFn, ParamListBase, ReplaceFn};

// Route names live with the navigators (`app/navigation/types.ts`); feature
// code navigates through intents (`AppNavigation` in `@core/navigation`).

/**
 * Shared navigation primitives for feature screens and shell navigators.
 */
export interface NavigationBackHandle {
  goBack: () => void;
  canGoBack?: () => boolean;
}

export interface ScreenNavigationProp<
  ParamList extends ParamListBase,
  RouteName extends keyof ParamList = keyof ParamList,
> {
  goBack: () => void;
  canGoBack?: () => boolean;
  navigate: NavigateFn<ParamList>;
  reset: (state: unknown) => void;
  replace?: ReplaceFn<ParamList>;
  setParams?: (params: Partial<ParamList[RouteName]>) => void;
  getParent: <TParent = unknown>(id?: string) => TParent;
  addListener: (
    event: string,
    callback: (event: unknown) => void,
  ) => () => void;
  dispatch?: (action: unknown) => void;
  setOptions?: (options: Record<string, unknown>) => void;
}

export interface ScreenRouteProp<
  ParamList extends ParamListBase,
  RouteName extends keyof ParamList,
> {
  key?: string;
  name?: RouteName;
  params: ParamList[RouteName];
}

export interface ScreenProps<
  ParamList extends ParamListBase,
  RouteName extends keyof ParamList,
> {
  navigation: ScreenNavigationProp<ParamList, RouteName>;
  route: ScreenRouteProp<ParamList, RouteName>;
}
