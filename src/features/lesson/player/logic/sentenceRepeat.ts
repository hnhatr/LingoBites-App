/**
 * YouTube lesson FR-07: how many times the current sentence plays again
 * before the video moves on. `0` is off; `'infinite'` loops until the
 * learner changes card or turns it off.
 */
export type SentenceRepeat = 0 | 1 | 3 | 5 | 'infinite';

export const SENTENCE_REPEAT_STEPS: readonly SentenceRepeat[] = [
  0,
  1,
  3,
  5,
  'infinite',
];

/** The next step of the repeat button: Tắt → 1× → 3× → 5× → ∞ → Tắt. */
export function nextSentenceRepeat(current: SentenceRepeat): SentenceRepeat {
  const index = SENTENCE_REPEAT_STEPS.indexOf(current);
  return SENTENCE_REPEAT_STEPS[(index + 1) % SENTENCE_REPEAT_STEPS.length];
}

/** "1×", "3×", "5×" or "∞"; null when repeating is off. */
export function formatSentenceRepeat(repeat: SentenceRepeat): string | null {
  if (repeat === 0) return null;
  return repeat === 'infinite' ? '∞' : `${repeat}×`;
}

/** Whether the sentence plays again, after `repeatsDone` jumps back so far. */
export function shouldRepeatSentence(
  repeat: SentenceRepeat,
  repeatsDone: number,
): boolean {
  if (repeat === 'infinite') return true;
  return repeatsDone < repeat;
}
