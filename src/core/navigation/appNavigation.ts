import {createContext, useContext} from 'react';

/**
 * App-wide navigation intents (port).
 *
 * Features say *what* they want ("open this lesson", "start a YouTube
 * lesson") and never *where* it lives (tab, stack, route name). The only
 * implementation is the adapter in `app/navigation/appNavigationAdapter.ts`,
 * which is the single place that knows the navigator layout:
 *
 * - Tabs hold only their hub screen (Home, Courses, Lessons, Profile).
 * - Task flows (create a lesson, lesson player, review, speaking, today,
 *   catalog) are registered once on the root stack, above the tab bar, so
 *   back always returns to the tab that opened them.
 *
 * Feature code must use `useAppNavigation()` for anything that leaves the
 * current screen's own flow; reaching into a parent navigator with
 * `getParent()` is rejected by `yarn lint:boundaries`.
 */

export type AppTabName = 'Home' | 'Courses' | 'Lessons' | 'Profile';

/** One Library list: the learner's own sections, then the public catalog. */
export type LibrarySectionKey =
  | 'mine'
  | 'video'
  | 'vocabulary'
  | 'grammar'
  | 'public'
  | 'publicVideo';

export type CreateEntry =
  /** Open the paste-text composer. */
  | {kind: 'paste'}
  /** Pick an image from the camera or the gallery, then OCR review. */
  | {kind: 'camera' | 'gallery'}
  /** Open the YouTube link composer. */
  | {kind: 'youtube'; submissionId?: string}
  /** Submit already-confirmed text and show creation progress. */
  | {kind: 'text' | 'ocr'; text: string; submissionId?: string};

/**
 * One step of the structured curriculum (Course → Level → Unit → Lesson).
 * `title` is only shown in the header while the screen loads its list.
 */
export type CourseTarget =
  /** The levels of one course. */
  | {kind: 'course'; courseSlug: string; title?: string}
  /** The units of one level, each with its progress bar. */
  | {kind: 'level'; levelId: string; title?: string}
  /** The lessons of one unit; a lesson opens with `openLesson`. */
  | {kind: 'unit'; unitId: string; title?: string};

export interface AppNavigation {
  /** Open one lesson in the lesson player. */
  openLesson(lessonId: string): void;
  /** Open a curriculum lesson's six-step player (PR 10). */
  openLessonFlow(lessonId: string): void;
  /** Open the lesson catalog. */
  openCatalog(): void;
  /** Open one Library section's list (own lessons, words, or public). */
  openLibrarySection(section: LibrarySectionKey): void;
  /**
   * Open the "Học qua video" hub: the video in progress, own and public
   * videos, and creating a lesson from a YouTube link.
   */
  openVideoHub(): void;
  /**
   * Open the structured curriculum: the course list without a target,
   * otherwise one course, level or unit.
   */
  openCourse(target?: CourseTarget): void;
  /** Open the create-lesson hub (camera, gallery, paste, YouTube). */
  openCreate(): void;
  /** Start (or continue to the next step of) the create-lesson flow. */
  startCreate(entry: CreateEntry): void;
  /**
   * Leave the create-lesson flow and show the created lesson. The flow
   * screens are removed, so back from the lesson returns to the tab the
   * flow was started from.
   */
  finishCreate(lessonId: string): void;
  openReview(): void;
  /** Open a quick-practice quiz generated from one downloaded lesson. */
  openPractice(lessonId: string): void;
  /**
   * Open the full "Hôm nay" study-block screen, optionally pre-selecting a
   * study length.
   */
  openToday(target?: {mode?: '5-minute' | 'normal' | 'deep-practice'}): void;
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
