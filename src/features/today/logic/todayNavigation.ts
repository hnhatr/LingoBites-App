import {resolveShadowingEntry} from '@features/speaking';

import type {AppNavigation} from '@core/navigation';

import type {StudyActivityItem, TodayNavigationTarget} from './types';

export type TodayNavigationRequest =
  | {screen: 'DailyReview'}
  | {screen: 'ItemReview'}
  | {screen: 'CanonicalLessonPlayer'; lessonId: string}
  | {screen: 'CanonicalCatalog'}
  | {screen: 'SpeakingRoom'}
  | {screen: 'ShadowingLessonPicker'}
  | {screen: 'ShadowingSession'; lessonId: string; sentenceIndex: number};

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
  if (target.screen === 'ItemReview') {
    return {screen: 'ItemReview'};
  }
  if (target.screen === 'FlashcardList') {
    return {screen: 'DailyReview'};
  }
  if (target.screen === 'SpeakingRoom') {
    return {screen: 'SpeakingRoom'};
  }
  if (target.screen === 'SpeakingShadowing') {
    const entry = resolveShadowingEntry();
    if (entry.screen === 'ShadowingSession') {
      return {
        screen: 'ShadowingSession',
        lessonId: entry.lessonId,
        sentenceIndex: entry.sentenceIndex,
      };
    }
    return {screen: 'ShadowingLessonPicker'};
  }
  if (target.screen === 'CanonicalCatalog') {
    return {screen: 'CanonicalCatalog'};
  }
  return {screen: 'DailyReview'};
}

/**
 * Opens the screen for one study activity. Shared by the Today screen and the
 * Home "Gợi ý hôm nay" card so both start an activity the same way.
 *
 * `ContentLessonRuntime` targets open the content-package runtime screen
 * (never the removed v1 `SavedLessonDetail`), and `FlashcardList` targets
 * fall back to `DailyReview` (LING-48 / TASK-007).
 */
export function openStudyActivity(
  navigation: AppNavigation,
  activity: StudyActivityItem,
): void {
  const resolved = resolveTodayNavigation(activity.navigationTarget);
  if (resolved.screen === 'CanonicalLessonPlayer') {
    navigation.openLesson(resolved.lessonId);
  } else if (resolved.screen === 'CanonicalCatalog') {
    navigation.openCatalog();
  } else if (resolved.screen === 'SpeakingRoom') {
    navigation.openSpeakingRoom();
  } else if (resolved.screen === 'ShadowingLessonPicker') {
    navigation.openShadowing();
  } else if (resolved.screen === 'ShadowingSession') {
    navigation.openShadowing({
      lessonId: resolved.lessonId,
      sentenceIndex: resolved.sentenceIndex,
    });
  } else if (resolved.screen === 'ItemReview') {
    navigation.openItemReview();
  } else {
    navigation.openReview();
  }
}
