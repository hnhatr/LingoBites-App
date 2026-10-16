import {createRandom} from '../random';
import {
  answerWords,
  letterBank,
  mixed,
  nextTile,
  nextWord,
  wordBank,
  wordSuggestions,
} from '../tileBank';

describe('tile banks', () => {
  it('keeps inner punctuation on its word and drops the closing mark', () => {
    expect(answerWords("Yes, what's your name?")).toEqual([
      'yes,',
      "what's",
      'your',
      'name',
    ]);
  });

  it('gives the answer letters in ABC order, three noise letters and the extras', () => {
    const bank = letterBank("What's up?", 'seed');
    for (const letter of ['a', 'h', 'p', 's', 't', 'u', 'w']) {
      expect(bank.letters).toContain(letter);
    }
    expect(bank.letters).toHaveLength(10);
    expect([...bank.letters].sort()).toEqual(bank.letters);
    expect(bank.extras).toEqual(["'"]);
    expect(letterBank("What's up?", 'seed')).toEqual(bank);
  });

  it('adds noise words from the vocabulary, never the answer in order', () => {
    const bank = wordBank(
      'I want a cup of tea',
      ['coffee', 'milk', 'tea'],
      'x',
    );
    expect(bank).toHaveLength(9);
    expect(bank).toEqual(expect.arrayContaining(['coffee', 'milk']));
    expect(bank.slice(0, 6)).not.toEqual(answerWords('I want a cup of tea'));
  });

  it('falls back to common words for noise', () => {
    const bank = wordBank('Hello there', [], 'y');
    expect(bank).toHaveLength(5);
  });

  it('never leaves a two-word bank reading as the answer', () => {
    const random = createRandom('fixed');
    for (let i = 0; i < 20; i += 1) {
      expect(mixed(['a', 'b'], ['a', 'b'], random)).toEqual(['b', 'a']);
    }
  });

  it('lights the next key, a space, or delete after a wrong letter', () => {
    expect(nextTile('I want tea.', '')).toBe('i');
    expect(nextTile('I want tea.', 'I')).toBe(' ');
    expect(nextTile('I want tea.', 'I w')).toBe('a');
    expect(nextTile('I want tea.', 'I wx')).toBe('delete');
    expect(nextTile('I want tea.', 'I want tea')).toBeNull();
  });

  it('names the next word while the words so far are right', () => {
    expect(nextWord('I want tea', 'i')).toBe('want');
    expect(nextWord('I want tea', 'i tea')).toBeNull();
  });

  it('suggests lesson words after two letters', () => {
    expect(wordSuggestions('i want co', ['coffee', 'cold', 'tea'])).toEqual([
      'coffee',
      'cold',
    ]);
    expect(wordSuggestions('i want c', ['coffee'])).toEqual([]);
    expect(wordSuggestions('i want cold', ['cold'])).toEqual([]);
  });
});
