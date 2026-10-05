import {listCompletedLessons} from '@core/sync/lessonProgress';

import {
  readWeeklyGoalTargetSetting,
  writeWeeklyGoalTargetSetting,
} from './data/EngagementSettingsRepository';
import {
  clearPendingDiligentObservation,
  latchDiligentBadgeEarnedAt,
  readDiligentBadgeLatch,
  readPendingDiligentObservation,
  writePendingDiligentObservation,
} from './data/WeeklyGoalBadgeRepository';
import {
  anyWeekReachesTarget,
  countCompletionsInWeek,
  resolveWeeklyGoalTarget,
  WEEKLY_LESSON_TARGET,
  type WeeklyGoalLessonRow,
} from './weeklyGoalPolicy';

export type WeeklyGoalState = {
  completedThisWeek: number;
  /** The learner's chosen weekly goal (F6). */
  target: number;
  /** Fixed weekly count that earns the diligent badge. */
  badgeTarget: number;
  badgeEarned: boolean;
};

/** The learner's weekly lesson goal (3/5/7), or the default when unset. */
export function getWeeklyGoalTarget(): number {
  return resolveWeeklyGoalTarget(readWeeklyGoalTargetSetting());
}

/** Saves the weekly goal; returns false when the value is not an option. */
export function setWeeklyGoalTarget(target: number): boolean {
  if (resolveWeeklyGoalTarget(target) !== target) {
    return false;
  }
  try {
    writeWeeklyGoalTargetSetting(target);
    return true;
  } catch (error) {
    console.log('[weeklyGoal] goal write failed', error);
    return false;
  }
}

function loadCompletedRows(): WeeklyGoalLessonRow[] {
  try {
    return listCompletedLessons();
  } catch (error) {
    console.log('[weeklyGoal] listCompletedLessons failed', error);
    return [];
  }
}

function tryPersistDiligentLatch(earnedAtIso: string): boolean {
  try {
    latchDiligentBadgeEarnedAt(earnedAtIso);
    if (readDiligentBadgeLatch() !== null) {
      clearPendingDiligentObservation();
      return true;
    }
    return false;
  } catch (error) {
    console.log('[weeklyGoal] latch write failed', error);
    return false;
  }
}

function promotePendingObservation(): void {
  const pending = readPendingDiligentObservation();
  if (pending === null || readDiligentBadgeLatch() !== null) {
    return;
  }
  tryPersistDiligentLatch(pending);
}

/**
 * Derives weekly goal progress and the diligent badge (FR-007, AD-002).
 * Progress is measured against the learner's goal; the badge always needs
 * {@link WEEKLY_LESSON_TARGET} lessons in one week.
 * Latches the badge in the same synchronous call when first derived true.
 */
export function getWeeklyGoalState(now = new Date()): WeeklyGoalState {
  promotePendingObservation();

  const rows = loadCompletedRows();
  const derivedEarned = anyWeekReachesTarget(rows);
  const earnedAtIso = now.toISOString();

  if (derivedEarned && readDiligentBadgeLatch() === null) {
    if (!tryPersistDiligentLatch(earnedAtIso)) {
      writePendingDiligentObservation(earnedAtIso);
    }
  }

  const badgeEarned =
    readDiligentBadgeLatch() !== null ||
    readPendingDiligentObservation() !== null;

  return {
    completedThisWeek: countCompletionsInWeek(rows, now),
    target: getWeeklyGoalTarget(),
    badgeTarget: WEEKLY_LESSON_TARGET,
    badgeEarned,
  };
}
