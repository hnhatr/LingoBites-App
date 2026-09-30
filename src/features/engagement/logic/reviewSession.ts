import {createRequestId} from '@core/api/requestId';
import type {ReviewRating} from '@core/db/types';

import {insertGamificationEvent} from './data/GamificationRepository';
import {
  isOnTimeReview,
  ON_TIME_WATER_POINTS,
  sessionXp,
} from './gamificationPolicy';

/**
 * One completed review session as seen by the engagement layer (REQ-11, ADR-4).
 *
 * A "session" is the run of due cards the learner rates in one visit to the
 * daily review screen. The screen records each rated card into the session and
 * calls `finish()` when the session ends (the whole batch is done, or the
 * learner leaves after rating at least one card). Finishing appends the
 * gamification events — a `review_session_completed` event carrying the XP the
 * session earned, plus a `review_on_time` event per card reviewed on or before
 * its due day. No event is written unless at least one card was actually rated,
 * so gamification can never credit a review that did not happen.
 */

export type RatedCardOutcome = {
  flashcardId: string;
  rating: ReviewRating;
  /**
   * The card's due instant *before* it was rated (null when unknown). Used to
   * decide whether the review was on time.
   */
  dueAt: string | null;
  reviewedAt: string;
};

export type ReviewSessionFinishResult =
  | {
      ok: true;
      xpEarned: number;
      onTimeCount: number;
      waterUnits: number;
    }
  | {
      ok: false;
      errorCode: 'LOCAL_DB_ERROR';
      message: string;
    };

export type ReviewSession = {
  readonly sessionId: string;
  /** Number of rated cards recorded so far (skipped cards never count). */
  readonly ratedCount: number;
  record: (outcome: RatedCardOutcome) => void;
  /**
   * Persists the session's gamification events. Idempotent — calling it twice
   * (or after the learner has left) is a no-op. Returns null when there is
   * nothing to record (no ratings yet, or already finished).
   */
  finish: (completedAt?: string) => ReviewSessionFinishResult | null;
};

export function startReviewSession(): ReviewSession {
  const sessionId = createRequestId();
  const outcomes: RatedCardOutcome[] = [];
  let finished = false;

  function record(outcome: RatedCardOutcome): void {
    if (finished) {
      return;
    }
    outcomes.push(outcome);
  }

  function finish(
    completedAt = new Date().toISOString(),
  ): ReviewSessionFinishResult | null {
    if (finished || outcomes.length === 0) {
      return null;
    }
    finished = true;

    try {
      const counts = {remembered: 0, forgot: 0};
      for (const outcome of outcomes) {
        counts[outcome.rating] += 1;
      }
      const xpEarned = sessionXp(counts);

      insertGamificationEvent({
        eventType: 'review_session_completed',
        sourceEventId: sessionId,
        points: xpEarned,
        createdAt: completedAt,
      });

      let onTimeCount = 0;
      for (const outcome of outcomes) {
        if (
          !isOnTimeReview({
            dueAt: outcome.dueAt,
            reviewedAt: outcome.reviewedAt,
          })
        ) {
          continue;
        }
        onTimeCount += 1;
        insertGamificationEvent({
          eventType: 'review_on_time',
          sourceEventId: `${sessionId}:${outcome.flashcardId}`,
          points: ON_TIME_WATER_POINTS,
          createdAt: outcome.reviewedAt,
        });
      }

      return {
        ok: true,
        xpEarned,
        onTimeCount,
        waterUnits: onTimeCount * ON_TIME_WATER_POINTS,
      };
    } catch {
      return {
        ok: false,
        errorCode: 'LOCAL_DB_ERROR',
        message: 'Không thể ghi nhận thành tích. Vui lòng thử lại.',
      };
    }
  }

  return {
    sessionId,
    get ratedCount() {
      return outcomes.length;
    },
    record,
    finish,
  };
}
