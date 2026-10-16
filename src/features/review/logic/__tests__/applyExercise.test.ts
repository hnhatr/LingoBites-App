import {
  type ApplySentence,
  buildApplyExercise,
  isOrderCorrect,
  isSwapCorrect,
  normaliseAnswer,
  orderExercise,
  shuffleWords,
  swapExercise,
  verbSpan,
} from '../applyExercise';

/** Vocab path P6: written stage-4 cards from combo sentences, graded on the device. */

function sentence(
  id: string,
  group: string,
  subject: string,
  words: Array<[string, string]>,
  polarity = 'affirmative',
): ApplySentence {
  return {
    id,
    subject_group: group,
    subject_text: subject,
    polarity,
    text_en: `${words.map(([t]) => t).join(' ')}.`,
    text_vi: `câu ${id}`,
    tokens: words.map(([t, role]) => ({t, role})),
  };
}

const iPlaced = sentence('s1', 'i', 'I', [
  ['i', 'subject'],
  ['have', 'aux'],
  ['placed', 'verb'],
  ['emphasis', 'item'],
  ['on', 'other'],
  ['safety', 'other'],
]);
const shePlaced = sentence('s2', 'he_she', 'She', [
  ['she', 'subject'],
  ['has', 'aux'],
  ['placed', 'verb'],
  ['emphasis', 'item'],
  ['on', 'other'],
  ['price', 'other'],
]);
const sheNot = sentence(
  's3',
  'he_she',
  'She',
  [
    ['she', 'subject'],
    ['has', 'aux'],
    ['not', 'other'],
    ['placed', 'verb'],
    ['it', 'other'],
  ],
  'negative',
);

test('shuffling never gives back the same order and is the same for the same seed', () => {
  const words = ['i', 'have', 'placed', 'emphasis'];
  for (let seed = 1; seed < 50; seed += 1) {
    const shuffled = shuffleWords(words, seed);
    expect([...shuffled].sort()).toEqual([...words].sort());
    expect(shuffled).not.toEqual(words);
  }
  expect(shuffleWords(words, 7)).toEqual(shuffleWords(words, 7));
  expect(shuffleWords(['a', 'a'], 3)).toEqual(['a', 'a']);
});

test('the verb block runs through auxiliaries, the verb and not', () => {
  expect(verbSpan(iPlaced.tokens)).toEqual({start: 1, end: 3});
  expect(verbSpan(sheNot.tokens)).toEqual({start: 1, end: 4});
  expect(verbSpan([{t: 'hello', role: 'other'}])).toBeNull();
});

test('an ordering card asks the Vietnamese sentence and grades the word order', () => {
  const exercise = orderExercise(iPlaced, 5)!;
  expect(exercise.promptVi).toBe('câu s1');
  expect(exercise.answer).toEqual(iPlaced.tokens.map(token => token.t));
  expect(isOrderCorrect(exercise, exercise.answer)).toBe(true);
  expect(isOrderCorrect(exercise, exercise.shuffled)).toBe(false);
  expect(isOrderCorrect(exercise, exercise.answer.slice(1))).toBe(false);
  expect(
    orderExercise(
      sentence('s9', 'i', 'I', [
        ['i', 'subject'],
        ['run', 'verb'],
      ]),
      5,
    ),
  ).toBeNull();
});

test('a swap card takes another subject of the same polarity and blanks its verb', () => {
  const exercise = swapExercise([iPlaced, shePlaced, sheNot], 3)!;
  expect(['s1', 's2']).toContain(exercise.sentenceId);
  const target = exercise.sentenceId === 's2' ? shePlaced : iPlaced;
  expect(exercise.answer).toBe(
    target === shePlaced ? 'has placed' : 'have placed',
  );
  expect(exercise.before).toBe(target === shePlaced ? 'She' : 'I');
  expect(exercise.after).toBe(
    target === shePlaced ? 'emphasis on price' : 'emphasis on safety',
  );
  expect(swapExercise([iPlaced], 3)).toBeNull();
  expect(swapExercise([iPlaced, sheNot], 3)).toBeNull();
});

test('swap answers ignore case, spaces and contractions', () => {
  const exercise = swapExercise(
    [
      iPlaced,
      sheNot,
      {
        ...sheNot,
        id: 's4',
        subject_group: 'i',
        subject_text: 'I',
        tokens: [
          {t: 'i', role: 'subject'},
          {t: 'have', role: 'aux'},
          {t: 'not', role: 'other'},
          {t: 'placed', role: 'verb'},
          {t: 'it', role: 'other'},
        ],
      },
    ],
    1,
  )!;
  expect(exercise.answer).toMatch(/not placed$/);
  const contracted = exercise.answer.replace(' not', "n't");
  expect(isSwapCorrect(exercise, `  ${contracted.toUpperCase()} `)).toBe(true);
  expect(isSwapCorrect(exercise, 'placed')).toBe(false);
  expect(normaliseAnswer("Won't go")).toBe('will not go');
  expect(normaliseAnswer('cannot')).toBe(normaliseAnswer("can't"));
});

test('the card follows the seed and falls back to the other kind', () => {
  const sets = [[iPlaced, shePlaced]];
  expect(buildApplyExercise(sets, 1)?.kind).toBe('swap');
  expect(buildApplyExercise(sets, 2)?.kind).toBe('order');
  const twoWords = [
    [
      sentence('a', 'i', 'I', [
        ['i', 'subject'],
        ['play', 'verb'],
      ]),
      sentence('b', 'he_she', 'She', [
        ['she', 'subject'],
        ['plays', 'verb'],
      ]),
    ],
  ];
  expect(buildApplyExercise(twoWords, 2)?.kind).toBe('swap');
  expect(buildApplyExercise([[iPlaced]], 1)?.kind).toBe('order');
  expect(buildApplyExercise([], 1)).toBeNull();
});
