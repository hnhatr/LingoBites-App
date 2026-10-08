import type {LessonAttemptOutcome} from '@core/schemas/sync';

/**
 * How one entry of an activity (a sentence, a question, a learner turn) went:
 * right on the first try (or judged "Đạt" first time), right only after
 * trying again, or not done ("Chưa đạt", skipped or answer shown).
 */
export type EntryResult = 'first_try' | 'after_retry' | 'not_yet';

/**
 * The outcome of a whole activity block (decision G3): every entry right at
 * once → `pass_independent`; all right but some only after a retry →
 * `pass_with_support`; any entry not done → `fail`. Hints come in PR 11, so
 * the support level is always `none` here.
 */
export function blockOutcome(
  results: readonly EntryResult[],
): LessonAttemptOutcome {
  if (results.length === 0) return 'unscorable';
  if (results.includes('not_yet')) return 'fail';
  if (results.includes('after_retry')) return 'pass_with_support';
  return 'pass_independent';
}
