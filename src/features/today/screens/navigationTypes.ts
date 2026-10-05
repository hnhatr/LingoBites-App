import type {TodayMode} from '../logic/types';

/** Optional pre-selected study length (e.g. from the Home suggestion card). */
export type TodayRouteParams = {mode?: TodayMode} | undefined;
