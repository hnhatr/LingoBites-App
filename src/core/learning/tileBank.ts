/**
 * Tile writing (bàn phím ô chữ): the tiles a learner taps to write an answer
 * without the phone keyboard. Three banks, from easy to hard:
 * - `words`: the answer's words, shuffled, with a few noise words;
 * - `letters`: only the letters the answer uses, with a few noise letters,
 *   in ABC order so a letter is easy to find;
 * - `keyboard`: the full QWERTY keyboard, for well-known or free answers.
 * Tiles are lower-case; grading lower-cases anyway (`normalizeAnswer`).
 */
import {normalizeAnswer} from './acceptedAnswers';
import {createRandom, shuffled} from './random';

export type TileMode = 'words' | 'letters' | 'keyboard';

export const TILE_MODES: readonly TileMode[] = ['words', 'letters', 'keyboard'];

export const QWERTY_ROWS: readonly string[] = [
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
];

/** Punctuation keys of the full keyboard. */
export const KEYBOARD_EXTRAS: readonly string[] = ["'", ',', '.', '?', '!'];

const NOISE_LETTERS = 3;
const NOISE_WORDS = 3;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
/** Noise words when the lesson gives none: short, common, easy to confuse. */
const COMMON_WORDS = ['the', 'a', 'is', 'are', 'do', 'to', 'in', 'on', 'it'];

/**
 * The answer's words as tiles: grading form, so inner punctuation stays on
 * its word (`yes,` `what's`) and the closing mark is dropped.
 */
export function answerWords(answer: string): string[] {
  return normalizeAnswer(answer).split(' ').filter(Boolean);
}

/** Lesson words fit for tiles: plain words, not pattern slots like `{verb}`. */
function vocabularyWords(vocabulary: readonly string[]): string[] {
  return vocabulary
    .flatMap(entry => answerWords(entry))
    .filter(word => /^[\p{L}'-]+$/u.test(word));
}

export type LetterBank = {
  /** Letters in ABC order: the answer's own and a few noise letters. */
  letters: string[];
  /** Other keys the answer needs, such as `'` `,` or digits. */
  extras: string[];
};

export function letterBank(answer: string, seed: string): LetterBank {
  const text = normalizeAnswer(answer);
  const own = new Set<string>();
  const extras = new Set<string>();
  for (const char of text) {
    if (char === ' ') continue;
    if (/\p{L}/u.test(char)) own.add(char);
    else extras.add(char);
  }
  const free = ALPHABET.split('').filter(letter => !own.has(letter));
  const noise = shuffled(free, createRandom(`letters:${seed}`)).slice(
    0,
    NOISE_LETTERS,
  );
  return {
    letters: [...own, ...noise].sort((a, b) => a.localeCompare(b)),
    extras: [...extras],
  };
}

/**
 * The answer's words and up to three noise words, shuffled so the bank never
 * reads as the answer itself. Noise comes from `vocabulary` (the lesson's
 * words) and falls back to common words.
 */
export function wordBank(
  answer: string,
  vocabulary: readonly string[],
  seed: string,
): string[] {
  const own = answerWords(answer);
  const taken = new Set(own);
  const random = createRandom(`words:${seed}`);
  const candidates = [
    ...shuffled(vocabularyWords(vocabulary), random),
    ...shuffled(COMMON_WORDS, random),
  ];
  const noise: string[] = [];
  for (const word of candidates) {
    if (noise.length >= NOISE_WORDS) break;
    if (taken.has(word)) continue;
    taken.add(word);
    noise.push(word);
  }
  return mixed([...own, ...noise], own, random);
}

/** Shuffles `tiles` until they no longer start with `answer` in order. */
export function mixed(
  tiles: readonly string[],
  answer: readonly string[],
  random: () => number,
): string[] {
  let result = shuffled(tiles, random);
  const readsAsAnswer = () =>
    answer.length > 1 && answer.every((word, index) => result[index] === word);
  for (let tries = 0; tries < 5 && readsAsAnswer(); tries += 1) {
    result = shuffled(tiles, random);
  }
  if (readsAsAnswer()) result = [...result.slice(1), result[0]!];
  return result;
}

/**
 * The key the bulb hint lights: the next character of `answer` after
 * `typed`, `' '` for a space, `'delete'` when `typed` already went wrong,
 * or null when nothing is left to type.
 */
export function nextTile(
  answer: string,
  typed: string,
): string | 'delete' | null {
  const target = normalizeAnswer(answer);
  const written = typed.toLowerCase().replace(/\s+/g, ' ').replace(/^ /, '');
  if (!target.startsWith(written)) return 'delete';
  return target.charAt(written.length) || null;
}

/** The next word of `answer` in the words bank, or null when done or off. */
export function nextWord(answer: string, typed: string): string | null {
  const target = answerWords(answer);
  const written = answerWords(typed);
  if (!written.every((word, index) => target[index] === word)) return null;
  return target[written.length] ?? null;
}

/** Up to four lesson words that complete the word being typed. */
export function wordSuggestions(
  typed: string,
  vocabulary: readonly string[],
): string[] {
  const prefix = /(\S+)$/.exec(typed.toLowerCase())?.[1] ?? '';
  if (prefix.length < 2) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const word of vocabularyWords(vocabulary)) {
    if (result.length >= 4) break;
    if (word === prefix || !word.startsWith(prefix) || seen.has(word)) continue;
    seen.add(word);
    result.push(word);
  }
  return result;
}
