/** Fixed weekly lesson target (LING-222 Q-003 ★A). */
export const WEEKLY_LESSON_TARGET = 6;

export type WeeklyGoalLessonRow = {
  lessonId: string;
  completedAt: string;
};

/** Local Monday 00:00:00.000 for the calendar week containing `date`. */
export function startOfLocalWeek(date: Date): Date {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const mondayOffset = (date.getDay() + 6) % 7;
  return new Date(year, month, day - mondayOffset, 0, 0, 0, 0);
}

function endOfLocalWeek(weekStart: Date): Date {
  return new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate() + 7,
    0,
    0,
    0,
    0,
  );
}

function parseCompletedAtMs(completedAt: string): number | null {
  const ms = Date.parse(completedAt);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Counts completed lessons whose `completed_at` falls in the half-open local
 * week `[weekStart, weekStart + 7 local days)` for `now` (INV-001).
 */
export function countCompletionsInWeek(
  rows: readonly WeeklyGoalLessonRow[],
  now: Date,
): number {
  const weekStart = startOfLocalWeek(now);
  const weekEnd = endOfLocalWeek(weekStart);
  const startMs = weekStart.getTime();
  const endMs = weekEnd.getTime();
  let count = 0;
  for (const row of rows) {
    const completedMs = parseCompletedAtMs(row.completedAt);
    if (completedMs === null) {
      continue;
    }
    if (completedMs >= startMs && completedMs < endMs) {
      count += 1;
    }
  }
  return count;
}

/** True when some local calendar week contains at least {@link WEEKLY_LESSON_TARGET} completions. */
export function anyWeekReachesTarget(
  rows: readonly WeeklyGoalLessonRow[],
): boolean {
  const countsByWeekStart = new Map<number, number>();
  for (const row of rows) {
    const completedMs = parseCompletedAtMs(row.completedAt);
    if (completedMs === null) {
      continue;
    }
    const weekStartMs = startOfLocalWeek(new Date(completedMs)).getTime();
    countsByWeekStart.set(
      weekStartMs,
      (countsByWeekStart.get(weekStartMs) ?? 0) + 1,
    );
  }
  for (const count of countsByWeekStart.values()) {
    if (count >= WEEKLY_LESSON_TARGET) {
      return true;
    }
  }
  return false;
}
