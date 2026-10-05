import {insertGamificationEvent} from './data/GamificationRepository';

/**
 * Streak credit for learning outside the review screen (F10).
 *
 * Completing a lesson or finishing a Shadowing session appends a zero-point
 * event to the gamification log so the day counts toward the streak exactly
 * like a review session does (see `STREAK_EVENT_TYPES`). Recording is
 * best-effort: a failed write must never break the lesson or speaking flow,
 * so these helpers return false instead of throwing.
 */

/** Records a lesson that just moved to completed. */
export function recordLessonCompletedActivity(
  lessonId: string,
  completedAt = new Date().toISOString(),
): boolean {
  try {
    insertGamificationEvent({
      eventType: 'lesson_completed',
      sourceEventId: lessonId,
      points: 0,
      createdAt: completedAt,
    });
    return true;
  } catch (error) {
    console.log('[studyActivity] lesson event write failed', error);
    return false;
  }
}

/** Records one finished Shadowing session (all sentences gone through). */
export function recordShadowingSessionActivity(
  lessonId: string,
  completedAt = new Date().toISOString(),
): boolean {
  try {
    insertGamificationEvent({
      eventType: 'shadowing_session_completed',
      sourceEventId: lessonId,
      points: 0,
      createdAt: completedAt,
    });
    return true;
  } catch (error) {
    console.log('[studyActivity] shadowing event write failed', error);
    return false;
  }
}
