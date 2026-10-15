import {
  formatSentenceRepeat,
  nextSentenceRepeat,
  shouldRepeatSentence,
} from '../sentenceRepeat';

describe('sentenceRepeat', () => {
  it('cycles off → 1× → 3× → 5× → ∞ → off', () => {
    expect(nextSentenceRepeat(0)).toBe(1);
    expect(nextSentenceRepeat(1)).toBe(3);
    expect(nextSentenceRepeat(3)).toBe(5);
    expect(nextSentenceRepeat(5)).toBe('infinite');
    expect(nextSentenceRepeat('infinite')).toBe(0);
  });

  it('labels each step', () => {
    expect(formatSentenceRepeat(0)).toBeNull();
    expect(formatSentenceRepeat(3)).toBe('3×');
    expect(formatSentenceRepeat('infinite')).toBe('∞');
  });

  it('plays again the chosen number of times', () => {
    expect(shouldRepeatSentence(0, 0)).toBe(false);
    expect(shouldRepeatSentence(3, 2)).toBe(true);
    expect(shouldRepeatSentence(3, 3)).toBe(false);
    expect(shouldRepeatSentence('infinite', 99)).toBe(true);
  });
});
