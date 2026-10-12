export type MinimalPair = readonly [string, string];

export type MinimalPairQuestion = {
  /** The word played aloud. It is one of the two words of the pair. */
  target: string;
  /** The two words of the pair, in the order shown to the learner. */
  options: [string, string];
};

/**
 * A pair can be quizzed only when its two words differ. Identical words
 * would make every answer correct, which teaches nothing.
 */
export function isQuizablePair(pair: MinimalPair): boolean {
  const [first, second] = pair.map(word => word.trim());
  return Boolean(first) && Boolean(second) && first !== second;
}

/**
 * Picks a quizable pair at random, then which of its words to play and the
 * order of the two choices. Returns null when no pair can be quizzed.
 */
export function buildMinimalPairQuestion(
  pairs: readonly MinimalPair[],
  random: () => number = Math.random,
): MinimalPairQuestion | null {
  const usable = pairs.filter(isQuizablePair);
  if (usable.length === 0) {
    return null;
  }
  const pair =
    usable[Math.min(usable.length - 1, Math.floor(random() * usable.length))]!;
  const target = pair[random() < 0.5 ? 0 : 1];
  const options: [string, string] =
    random() < 0.5 ? [pair[0], pair[1]] : [pair[1], pair[0]];
  return {target, options};
}

export function isCorrectChoice(
  question: MinimalPairQuestion,
  choice: string,
): boolean {
  return choice === question.target;
}
