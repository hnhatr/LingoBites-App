import type {RootStackParamList} from './types';

export function getRootStackRouteNames(features: {
  youtubeLearning?: unknown;
}): Array<Extract<keyof RootStackParamList, string>> {
  const names: Array<Extract<keyof RootStackParamList, string>> = ['Tabs'];
  if (features?.youtubeLearning) {
    names.push(
      'YouTubeHistory',
      'YouTubeLesson',
      'Practice',
    );
  }
  return names;
}
