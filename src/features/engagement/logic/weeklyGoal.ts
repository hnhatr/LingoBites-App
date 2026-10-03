import {listCompletedLessons} from '@core/sync/lessonProgress';

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
  WEEKLY_LESSON_TARGET,
  type WeeklyGoalLessonRow,
} from './weeklyGoalPolicy';

export type WeeklyGoalState = {
  completedThisWeek: number;
  target: number;
  badgeEarned: boolean;
};

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
    target: WEEKLY_LESSON_TARGET,
    badgeEarned,
  };
}
