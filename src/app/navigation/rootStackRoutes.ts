import type {RootStackParamList} from './types';

export function getRootStackRouteNames(_features?: {
  youtubeLearning?: unknown;
}): Array<Extract<keyof RootStackParamList, string>> {
  return ['Tabs'];
}
