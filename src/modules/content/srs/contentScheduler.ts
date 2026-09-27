/**
 * Generalized SRS scheduler for `content_review_items` (SETE-109 / M4).
 *
 * Scheduling policy implementation has been moved to `@shared/content/contentReviewPolicy`
 * so that shared database repositories can execute review state calculations without
 * depending on `@modules/content`.
 *
 * Exports preserved for `@modules/content` compatibility.
 */

export {
  CONTENT_INTERVAL_MINUTES,
  calculateNextContentReviewState,
  selectDueContentReviewItems,
} from '@shared/content/contentReviewPolicy';

export type {
  ContentMasteryState,
  ContentReviewOutcome,
  ContentScheduleInput,
  ContentScheduleResult,
  SelectDueContentReviewItemsOptions,
} from '@shared/content/contentReviewPolicy';
