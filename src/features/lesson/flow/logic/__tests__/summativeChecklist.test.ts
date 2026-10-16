import {usesEntry, wordsOf} from '../summativeChecklist';

/** Vocab path P6 (F7): the same matching rules as the Server's summative checklist. */

test('words of a text: lower case, apostrophes kept, punctuation breaks', () => {
  expect(wordsOf("I don't LIKE it, ‘really’!")).toEqual([
    'i',
    "don't",
    'like',
    'it',
    'really',
  ]);
});

test('a form matches whole words; pattern parts must come in order; tenses wait for the Server', () => {
  const words = wordsOf(
    'Not only did we visit two cities, but also we studied.',
  );
  expect(usesEntry(words, {type: 'forms', forms: ['cities', 'city']})).toBe(
    true,
  );
  expect(usesEntry(words, {type: 'forms', forms: ['cit']})).toBe(false);
  expect(
    usesEntry(words, {type: 'fixed_parts', parts: ['not only', 'but also']}),
  ).toBe(true);
  expect(
    usesEntry(words, {type: 'fixed_parts', parts: ['but also', 'not only']}),
  ).toBe(false);
  expect(usesEntry(words, {type: 'fixed_parts', parts: []})).toBe(false);
  expect(usesEntry(words, {type: 'tense'})).toBeNull();
});
