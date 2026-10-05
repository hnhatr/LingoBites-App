import {listCompletedLessons} from '@core/sync/lessonProgress';

/** Completed vs total lessons of one unit. */
export type UnitProgress = {completed: number; total: number};

/**
 * Lesson ids completed on this device (`lesson_progress.status = completed`,
 * not tombstoned). A local DB failure shows no progress instead of crashing
 * the curriculum screens.
 */
export function readCompletedLessonIds(): Set<string> {
  try {
    return new Set(listCompletedLessons().map(row => row.lessonId));
  } catch {
    return new Set();
  }
}

/** Counts how many of a unit's lessons are completed. */
export function countUnitProgress(
  lessonIds: readonly string[],
  completedIds: ReadonlySet<string>,
): UnitProgress {
  let completed = 0;
  for (const id of lessonIds) {
    if (completedIds.has(id)) completed += 1;
  }
  return {completed, total: lessonIds.length};
}

/** Fill ratio for a progress bar, clamped to 0..1 (an empty unit is 0). */
export function unitProgressRatio(progress: UnitProgress): number {
  if (progress.total <= 0) return 0;
  return Math.min(1, Math.max(0, progress.completed / progress.total));
}
