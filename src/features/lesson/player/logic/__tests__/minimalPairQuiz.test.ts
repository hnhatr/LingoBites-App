import {
  buildMinimalPairQuestion,
  isCorrectChoice,
  isQuizablePair,
} from '../minimalPairQuiz';

/** A random source that returns the given values in order, then 0. */
function sequence(...values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? 0;
}

describe('minimalPairQuiz', () => {
  it('rejects pairs whose words are blank or identical', () => {
    expect(isQuizablePair(['eight', 'ate'])).toBe(true);
    expect(isQuizablePair(['same', 'same'])).toBe(false);
    expect(isQuizablePair(['  ', 'ate'])).toBe(false);
  });

  it('returns null when no pair can be quizzed', () => {
    expect(buildMinimalPairQuestion([])).toBeNull();
    expect(buildMinimalPairQuestion([['same', 'same']])).toBeNull();
  });

  it('plays one word of the chosen pair and shows both words', () => {
    const question = buildMinimalPairQuestion(
      [['ship', 'sheep']],
      sequence(0, 0, 0),
    );
    expect(question).toEqual({target: 'ship', options: ['ship', 'sheep']});
  });

  it('can play the second word and reverse the choice order', () => {
    const question = buildMinimalPairQuestion(
      [['ship', 'sheep']],
      sequence(0, 0.9, 0.9),
    );
    expect(question).toEqual({target: 'sheep', options: ['sheep', 'ship']});
  });

  it('skips unquizable pairs when picking one', () => {
    const question = buildMinimalPairQuestion(
      [
        ['same', 'same'],
        ['eight', 'ate'],
      ],
      sequence(0, 0, 0),
    );
    expect(question?.options).toEqual(['eight', 'ate']);
  });

  it('marks only the played word as correct', () => {
    const question = buildMinimalPairQuestion([['ship', 'sheep']], () => 0)!;
    expect(isCorrectChoice(question, 'ship')).toBe(true);
    expect(isCorrectChoice(question, 'sheep')).toBe(false);
  });
});
