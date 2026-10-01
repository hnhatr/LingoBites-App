import type {TodayNavigationTarget} from './types';

export type TodayNavigationRequest =
  | {screen: 'DailyReview'}
  | {screen: 'CanonicalLessonPlayer'; lessonId: string}
  | {screen: 'CanonicalCatalog'}
  | {screen: 'SpeakingRoom'};

/**
 * Maps a study-activity navigation target to a surviving route (LING-149
 * TASK-008). Lesson activities open the unified canonical player; flashcard
 * targets use `DailyReview`.
 */
export function resolveTodayNavigation(
  target: TodayNavigationTarget,
): TodayNavigationRequest {
  if (target.screen === 'CanonicalLessonPlayer') {
    const lessonId = target.params?.lessonId;
    if (typeof lessonId === 'string' && lessonId.length > 0) {
      return {screen: 'CanonicalLessonPlayer', lessonId};
    }
    return {screen: 'CanonicalCatalog'};
  }
  if (target.screen === 'FlashcardList') {
    return {screen: 'DailyReview'};
  }
  if (
    target.screen === 'SpeakingRoom' ||
    target.screen === 'SpeakingShadowing'
  ) {
    return {screen: 'SpeakingRoom'};
  }
  if (target.screen === 'CanonicalCatalog') {
    return {screen: 'CanonicalCatalog'};
  }
  return {screen: 'DailyReview'};
}
