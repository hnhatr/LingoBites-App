import type {AnalysisVocabularyItem} from '@core/schemas/lesson';

import {
  findVocabularyForWord,
  normalizeIpa,
  pairWordsWithIpa,
  wordLookupKey,
} from '../sentenceIpa';

function vocab(word: string): AnalysisVocabularyItem {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    word,
    pos: 'n.',
    ipa: `/${word}/`,
    meaning: `nghĩa ${word}`,
  };
}

describe('sentenceIpa', () => {
  it('turns apostrophe stress marks into the IPA stress mark', () => {
    expect(normalizeIpa("f'ɔɹ  tʌd'eɪz ")).toBe('fˈɔɹ tʌdˈeɪz');
  });

  it('pairs each word with its IPA token when the counts match', () => {
    expect(
      pairWordsWithIpa("We'll play in two teams.", "w'il pl'eɪ ɪn t'u t'imz"),
    ).toEqual([
      {word: "We'll", ipa: 'wˈil'},
      {word: 'play', ipa: 'plˈeɪ'},
      {word: 'in', ipa: 'ɪn'},
      {word: 'two', ipa: 'tˈu'},
      {word: 'teams.', ipa: 'tˈimz'},
    ]);
  });

  it('returns null when the counts differ or IPA is missing', () => {
    expect(pairWordsWithIpa('Sentence 1 en.', 'ipa-1')).toBeNull();
    expect(pairWordsWithIpa('Hello', null)).toBeNull();
    expect(pairWordsWithIpa('', 'a')).toBeNull();
  });

  it('strips surrounding punctuation for lookup', () => {
    expect(wordLookupKey('“Teams.”')).toBe('teams');
    expect(wordLookupKey("today's,")).toBe("today's");
  });

  it('finds exact and inflected vocabulary entries', () => {
    const list = [vocab('against'), vocab('team'), vocab('in')];
    expect(findVocabularyForWord('Against', list)?.word).toBe('against');
    expect(findVocabularyForWord('teams.', list)?.word).toBe('team');
    expect(findVocabularyForWord('into', list)).toBeNull();
    expect(findVocabularyForWord('Rosa', list)).toBeNull();
  });
});
