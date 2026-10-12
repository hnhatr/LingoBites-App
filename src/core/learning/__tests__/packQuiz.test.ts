import {
  buildKnownCheck,
  buildRecognitionQuestions,
  KNOWN_CHECK_TIMES,
  knownCodesFrom,
} from '@core/learning/packQuiz';
import type {CatalogItem} from '@core/schemas/lesson';

/** Vocab path P5: the pack quiz asks each word's meaning, and a word is known only when both checks are right. */

function word(code: string, meaning: string): CatalogItem {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    code,
    kind: 'word',
    text: code.slice(code.indexOf(':') + 1),
    meaning_vi: meaning,
    ipa: null,
    part_of_speech: null,
    note_vi: null,
    audience: 'all',
    payload: {},
    audio: null,
    image: null,
    examples: [],
    variants: [],
    errors: [],
  };
}

const items = [
  word('word:coffee', 'cà phê'),
  word('word:tea', 'trà'),
  word('word:water', 'nước'),
  word('word:milk', 'sữa'),
  word('word:juice', 'nước ép'),
  word('word:bread', 'bánh mì'),
];

const rng = (() => {
  let seed = 7;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
})();

it('asks every word once, with the right meaning among the choices', () => {
  const questions = buildRecognitionQuestions(items, rng);
  expect(questions.map(question => question.itemCode).sort()).toEqual(
    items.map(item => item.code).sort(),
  );
  for (const question of questions) {
    expect(question.options).toHaveLength(3);
    expect(new Set(question.options).size).toBe(3);
    const answer = items.find(item => item.code === question.itemCode)!;
    expect(question.options[question.answerIndex]).toBe(answer.meaning_vi);
  }
});

it('a check asks five words, each exactly twice', () => {
  const questions = buildKnownCheck(items, rng);
  expect(questions).toHaveLength(5 * KNOWN_CHECK_TIMES);
  const counts = new Map<string, number>();
  for (const question of questions) {
    counts.set(question.itemCode, (counts.get(question.itemCode) ?? 0) + 1);
  }
  expect([...counts.values()].every(count => count === KNOWN_CHECK_TIMES)).toBe(
    true,
  );
});

it('knows a word only when both of its checks were right', () => {
  expect(
    knownCodesFrom([
      {itemCode: 'word:coffee', correct: true},
      {itemCode: 'word:coffee', correct: true},
      {itemCode: 'word:tea', correct: true},
      {itemCode: 'word:tea', correct: false},
      {itemCode: 'word:milk', correct: false},
      {itemCode: 'word:milk', correct: true},
    ]),
  ).toEqual(['word:coffee']);
});

it('an empty pack asks nothing', () => {
  expect(buildRecognitionQuestions([], rng)).toEqual([]);
  expect(buildKnownCheck([], rng)).toEqual([]);
});
