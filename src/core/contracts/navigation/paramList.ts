/**
 * Typed navigation helpers for feature-owned param lists (EC-001 / AD-002).
 * Param list compositions live in feature `navigationTypes` barrels; contracts
 * supply generic navigate typing without depending on feature modules.
 */

export type ParamListBase = Record<string, object | undefined>;

/** Compile-time navigate signature mirroring React Navigation. */
export type NavigateFn<ParamList extends ParamListBase> = {
  <RouteName extends keyof ParamList>(
    ...args: undefined extends ParamList[RouteName]
      ? [screen: RouteName] | [screen: RouteName, params: ParamList[RouteName]]
      : [screen: RouteName, params: ParamList[RouteName]]
  ): void;
};

export type ReplaceFn<ParamList extends ParamListBase> = NavigateFn<ParamList>;
