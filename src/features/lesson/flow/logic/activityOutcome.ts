import type {
  LessonAttemptOutcome,
  LessonSupportLevel,
} from '@core/schemas/sync';

/**
 * How one entry of an activity (a sentence, a question, a learner turn) went:
 * right on the first try (or judged "Đạt" first time), right only after
 * trying again, or not done ("Chưa đạt", skipped or answer shown).
 */
export type EntryResult = 'first_try' | 'after_retry' | 'not_yet';

/** An entry's result and the highest hint it opened (PR 11). */
export type EntryReport = {result: EntryResult; support: LessonSupportLevel};

const SUPPORT_ORDER: readonly LessonSupportLevel[] = [
  'none',
  'hint_1',
  'hint_2',
  'model',
];

/** The higher of two support levels. */
export function maxSupport(
  a: LessonSupportLevel,
  b: LessonSupportLevel,
): LessonSupportLevel {
  return SUPPORT_ORDER.indexOf(a) >= SUPPORT_ORDER.indexOf(b) ? a : b;
}

/**
 * One attempt for a whole activity block (PR 10 G3, PR 11 G2): the support
 * level is the highest hint opened in any entry. Every entry right at once
 * without hints → `pass_independent`; all right but after a retry or a hint
 * → `pass_with_support` (a supported attempt never passes independently);
 * any entry not done → `fail`.
 */
export function blockAttempt(reports: readonly EntryReport[]): {
  outcome: LessonAttemptOutcome;
  supportLevel: LessonSupportLevel;
} {
  const supportLevel = reports.reduce<LessonSupportLevel>(
    (level, report) => maxSupport(level, report.support),
    'none',
  );
  if (reports.length === 0) return {outcome: 'unscorable', supportLevel};
  if (reports.some(report => report.result === 'not_yet')) {
    return {outcome: 'fail', supportLevel};
  }
  if (
    supportLevel !== 'none' ||
    reports.some(report => report.result === 'after_retry')
  ) {
    return {outcome: 'pass_with_support', supportLevel};
  }
  return {outcome: 'pass_independent', supportLevel};
}
