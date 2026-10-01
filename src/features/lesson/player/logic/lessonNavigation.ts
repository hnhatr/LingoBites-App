/**
 * Shared lesson entry-point helpers (LING-179 TASK-001, DQ-001).
 *
 * Every reachable gate that opens a lesson or the lesson catalog goes
 * through these helpers so the route name, params and current-stack
 * behavior stay identical everywhere. The helpers are navigation only:
 * analytics stays at the existing call site (the Home rail keeps its
 * `unified_lesson_opened` / `source: home_rail` event) and no pre-open
 * guard is added (A-001, A-004).
 */

export type LessonPlayerNavigation = {
  navigate: (
    screen: 'CanonicalLessonPlayer',
    params: {lessonId: string},
  ) => void;
};

export type LessonCatalogNavigation = {
  navigate: (screen: 'CanonicalCatalog') => void;
};

/**
 * Open one lesson in `CanonicalLessonPlayer` inside the caller's current
 * stack, so back returns to the originating tab.
 */
export function openLesson(
  navigation: LessonPlayerNavigation,
  lessonId: string,
): void {
  navigation.navigate('CanonicalLessonPlayer', {lessonId});
}

/**
 * Open `CanonicalCatalog` inside the caller's current stack.
 */
export function openLessonCatalog(navigation: LessonCatalogNavigation): void {
  navigation.navigate('CanonicalCatalog');
}
