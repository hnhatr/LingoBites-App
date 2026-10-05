import {createContext, useContext} from 'react';

/**
 * App-wide navigation intents (port).
 *
 * Features say *what* they want ("open this lesson", "start a YouTube
 * lesson") and never *where* it lives (tab, stack, route name). The only
 * implementation is the adapter in `app/navigation/appNavigationAdapter.ts`,
 * which is the single place that knows the navigator layout:
 *
 * - Tabs hold only their hub screen (Home, Create, Lessons, Profile).
 * - Task flows (create a lesson, lesson player, review, speaking, today,
 *   catalog) are registered once on the root stack, above the tab bar, so
 *   back always returns to the tab that opened them.
 *
 * Feature code must use `useAppNavigation()` for anything that leaves the
 * current screen's own flow; reaching into a parent navigator with
 * `getParent()` is rejected by `yarn lint:boundaries`.
 */

export type AppTabName = 'Home' | 'Create' | 'Lessons' | 'Profile';

export type CreateEntry =
  /** Open the paste-text composer. */
  | {kind: 'paste'}
  /** Pick an image from the camera or the gallery, then OCR review. */
  | {kind: 'camera' | 'gallery'}
  /** Open the YouTube link composer. */
  | {kind: 'youtube'; submissionId?: string}
  /** Submit already-confirmed text and show creation progress. */
  | {kind: 'text' | 'ocr'; text: string; submissionId?: string};

export interface AppNavigation {
  /** Open one lesson in the lesson player. */
  openLesson(lessonId: string): void;
  /** Open the lesson catalog. */
  openCatalog(): void;
  /** Start (or continue to the next step of) the create-lesson flow. */
  startCreate(entry: CreateEntry): void;
  /**
   * Leave the create-lesson flow and show the created lesson. The flow
   * screens are removed, so back from the lesson returns to the tab the
   * flow was started from.
   */
  finishCreate(lessonId: string): void;
  openReview(): void;
  openToday(): void;
  openSpeakingRoom(): void;
  /**
   * Open shadowing practice: a specific lesson/sentence when given,
   * otherwise the lesson picker.
   */
  openShadowing(target?: {lessonId: string; sentenceIndex?: number}): void;
  /** Switch tab; the tab shows its hub screen. */
  goToTab(tab: AppTabName): void;
  /** Go back one screen, if possible. */
  goBack(): void;
}

const AppNavigationContext = createContext<AppNavigation | null>(null);

export const AppNavigationProvider = AppNavigationContext.Provider;

/** Returns the provided navigation, or null outside a provider. */
export function useOptionalAppNavigation(): AppNavigation | null {
  return useContext(AppNavigationContext);
}

export function useAppNavigation(): AppNavigation {
  const navigation = useContext(AppNavigationContext);
  if (!navigation) {
    throw new Error(
      'useAppNavigation must be used inside <AppNavigationProvider>.',
    );
  }
  return navigation;
}
