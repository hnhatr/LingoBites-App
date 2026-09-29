import type {TodayNavigationTarget} from './types';

export type TodayNavigationRequest =
  | {screen: 'DailyReview'}
  | {screen: 'ContentLessonRuntime'; lessonId: string}
  | {screen: 'LessonsList'};

/**
 * Maps a study-activity navigation target to a surviving route
 * (LING-48 / TASK-007).
 *
 * - `ContentLessonRuntime` targets open the content-package runtime screen
 *   instead of the removed v1 `SavedLessonDetail` screen. The lesson IDs
 *   produced by the adaptation engine come from the content-package
 *   catalog (`listActivePackageLessons`), so the runtime screen is the
 *   correct owner.
 * - `FlashcardList` targets fall back to `DailyReview`, which reviews due
 *   flashcards (`getDueFlashcards`) and is the surviving review surface
 *   after the v1 `FlashcardList` screen is removed.
 * - A `ContentLessonRuntime` target without a lesson ID cannot open a
 *   lesson, so it falls back to `DailyReview`.
 */
export function resolveTodayNavigation(
  target: TodayNavigationTarget,
): TodayNavigationRequest {
  if (target.screen === 'ContentLessonRuntime') {
    const lessonId = target.params?.lessonId;
    if (typeof lessonId === 'string' && lessonId.length > 0) {
      return {screen: 'ContentLessonRuntime', lessonId};
    }
    return {screen: 'DailyReview'};
  }
  if (target.screen === 'FlashcardList') {
    return {screen: 'DailyReview'};
  }
  if (target.screen === 'SpeakingRoom') {
    return {screen: 'LessonsList'};
  }
  return {screen: 'DailyReview'};
}
