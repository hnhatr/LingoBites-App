import {getUnitOutcome, listPassedLessonIds} from '@core/sync/learningOutcomes';
import {listCompletedLessons} from '@core/sync/lessonProgress';

/**
 * Completed vs total lessons of one unit; `passed` (PR 16) counts the
 * lessons the Server counts as passed, when known.
 */
export type UnitProgress = {completed: number; total: number; passed?: number};

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

/** Lesson ids passed according to the Server (`lesson_outcomes`). */
export function readPassedLessonIds(): Set<string> {
  try {
    return listPassedLessonIds();
  } catch {
    return new Set();
  }
}

/** Counts how many of a unit's lessons are completed (and passed). */
export function countUnitProgress(
  lessonIds: readonly string[],
  completedIds: ReadonlySet<string>,
  passedIds?: ReadonlySet<string>,
): UnitProgress {
  let completed = 0;
  let passed = 0;
  for (const id of lessonIds) {
    if (completedIds.has(id)) completed += 1;
    if (passedIds?.has(id)) passed += 1;
  }
  return passedIds
    ? {completed, total: lessonIds.length, passed}
    : {completed, total: lessonIds.length};
}

export type SummativeState = 'locked' | 'open' | 'passed';

/**
 * Decision B4 (G4): the unit's summative task opens once every lesson's
 * practice is complete. The Server's `unit_outcomes` row wins; without it
 * the device checks its own completed lessons.
 */
export function readSummativeState(
  unitId: string,
  lessonIds: readonly string[],
  completedIds: ReadonlySet<string>,
): SummativeState {
  let outcome = null;
  try {
    outcome = getUnitOutcome(unitId);
  } catch {
    outcome = null;
  }
  if (outcome?.passedAt) return 'passed';
  if (outcome?.summativeUnlockedAt) return 'open';
  return lessonIds.length > 0 && lessonIds.every(id => completedIds.has(id))
    ? 'open'
    : 'locked';
}

/** Fill ratio for a progress bar, clamped to 0..1 (an empty unit is 0). */
export function unitProgressRatio(progress: UnitProgress): number {
  if (progress.total <= 0) return 0;
  return Math.min(1, Math.max(0, progress.completed / progress.total));
}
