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

function loadCompletedRows(): WeeklyGoalLessonRow[] {
  try {
    return listCompletedLessons();
  } catch (error) {
    console.log('[weeklyGoal] listCompletedLessons failed', error);
    return [];
  }
}

/**
 * Derives weekly goal progress and the diligent badge (FR-007, AD-002).
 * Latches the badge in the same synchronous call when first derived true.
 */
export function getWeeklyGoalState(now = new Date()): WeeklyGoalState {
  const rows = loadCompletedRows();
  const latched = readDiligentBadgeLatch() !== null;
  const derivedEarned = anyWeekReachesTarget(rows);
  const badgeEarned = latched || derivedEarned;

  if (derivedEarned && !latched) {
    try {
      latchDiligentBadgeEarnedAt(now.toISOString());
    } catch (error) {
      console.log('[weeklyGoal] latch write failed', error);
    }
  }

  return {
    completedThisWeek: countCompletionsInWeek(rows, now),
    target: WEEKLY_LESSON_TARGET,
    badgeEarned,
  };
}
