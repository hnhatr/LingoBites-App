import {listCompletedLessons} from '@core/sync/lessonProgress';

import {
  latchDiligentBadgeEarnedAt,
  readDiligentBadgeLatch,
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

/** Earn time queued when a latch write fails; retried on the next read (ADV-001). */
let pendingDiligentObservationAt: string | null = null;

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
    return readDiligentBadgeLatch() !== null;
  } catch (error) {
    console.log('[weeklyGoal] latch write failed', error);
    return false;
  }
}

/**
 * Derives weekly goal progress and the diligent badge (FR-007, AD-002).
 * Latches the badge in the same synchronous call when first derived true.
 */
export function getWeeklyGoalState(now = new Date()): WeeklyGoalState {
  const earnedAtIso = now.toISOString();

  if (
    pendingDiligentObservationAt !== null &&
    readDiligentBadgeLatch() === null
  ) {
    if (tryPersistDiligentLatch(pendingDiligentObservationAt)) {
      pendingDiligentObservationAt = null;
    }
  }

  const rows = loadCompletedRows();
  const latched = readDiligentBadgeLatch() !== null;
  const derivedEarned = anyWeekReachesTarget(rows);

  if (derivedEarned && !latched) {
    if (!tryPersistDiligentLatch(earnedAtIso)) {
      pendingDiligentObservationAt = earnedAtIso;
    }
  }

  const badgeEarned =
    readDiligentBadgeLatch() !== null ||
    (derivedEarned && pendingDiligentObservationAt !== null);

  return {
    completedThisWeek: countCompletionsInWeek(rows, now),
    target: WEEKLY_LESSON_TARGET,
    badgeEarned,
  };
}
