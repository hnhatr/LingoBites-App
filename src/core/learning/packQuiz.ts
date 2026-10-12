import type {CatalogItem} from '@core/schemas/lesson';

/**
 * Vocab path P5: the questions of a word pack. Recognition (bậc 1) asks the
 * meaning of each word once, with up to two other words' meanings as wrong
 * choices. The quick known check asks five words twice each; a word known
 * from it is one the learner got right both times.
 */

export const KNOWN_CHECK_WORDS = 5;
export const KNOWN_CHECK_TIMES = 2;

export type QuizQuestion = {
  itemCode: string;
  prompt: string;
  options: string[];
  answerIndex: number;
};

type Rng = () => number;

function shuffled<T>(values: readonly T[], rng: Rng): T[] {
  const out = [...values];
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [out[index], out[swap]] = [out[swap]!, out[index]!];
  }
  return out;
}

/** The meaning question for one word, with up to two other words' meanings as wrong choices. */
export function questionFor(
  item: CatalogItem,
  pool: readonly CatalogItem[],
  rng: Rng = Math.random,
): QuizQuestion {
  const wrong = [
    ...new Set(
      pool
        .filter(other => other.code !== item.code)
        .map(other => other.meaning_vi)
        .filter(meaning => meaning !== item.meaning_vi),
    ),
  ];
  const options = shuffled(
    [item.meaning_vi, ...shuffled(wrong, rng).slice(0, 2)],
    rng,
  );
  return {
    itemCode: item.code,
    prompt: item.text,
    options,
    answerIndex: options.indexOf(item.meaning_vi),
  };
}

/** One question per word, in a random order. */
export function buildRecognitionQuestions(
  items: readonly CatalogItem[],
  rng: Rng = Math.random,
): QuizQuestion[] {
  return shuffled(items, rng).map(item => questionFor(item, items, rng));
}

/** Five words, each asked twice, in a random order. */
export function buildKnownCheck(
  items: readonly CatalogItem[],
  rng: Rng = Math.random,
): QuizQuestion[] {
  const chosen = shuffled(items, rng).slice(0, KNOWN_CHECK_WORDS);
  const asked = chosen.flatMap(item =>
    Array.from({length: KNOWN_CHECK_TIMES}, () => item),
  );
  return shuffled(asked, rng).map(item => questionFor(item, items, rng));
}

/** The codes answered right every time they were asked, from a full check. */
export function knownCodesFrom(
  answers: ReadonlyArray<{itemCode: string; correct: boolean}>,
): string[] {
  const tally = new Map<string, {asked: number; right: number}>();
  for (const answer of answers) {
    const entry = tally.get(answer.itemCode) ?? {asked: 0, right: 0};
    entry.asked += 1;
    if (answer.correct) entry.right += 1;
    tally.set(answer.itemCode, entry);
  }
  return [...tally.entries()]
    .filter(
      ([, entry]) =>
        entry.asked === KNOWN_CHECK_TIMES && entry.right === entry.asked,
    )
    .map(([code]) => code)
    .sort();
}
