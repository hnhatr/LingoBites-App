/**
 * Vocab path P6: written stage-4 review (bậc 3, vận dụng) from the combo
 * sentences the learner opened, graded on the device. Two kinds:
 * - `order`: the Vietnamese sentence, then its English words shuffled; the
 *   learner puts them back in order.
 * - `swap`: a model sentence, then another sentence of the same set with a
 *   different subject and the verb left blank; the learner types the verb as
 *   it goes with that subject (`I have placed` → `She ___ placed`).
 * Combo tokens are lower-case words without punctuation (Server `wordsOf`).
 */

export type ApplyToken = {t: string; role: string};

export type ApplySentence = {
  id: string;
  subject_group: string;
  subject_text: string;
  polarity: string;
  text_en: string;
  text_vi: string;
  tokens: ApplyToken[];
};

export type OrderExercise = {
  kind: 'order';
  sentenceId: string;
  promptVi: string;
  answer: string[];
  /** The answer's words in another order; never the answer itself. */
  shuffled: string[];
  textEn: string;
};

export type SwapExercise = {
  kind: 'swap';
  sentenceId: string;
  model: string;
  subject: string;
  promptVi: string;
  /** Words before and after the blank, already joined. */
  before: string;
  after: string;
  /** The words of the blank: the verb with its auxiliaries (and `not`). */
  answer: string;
  textEn: string;
};

export type ApplyExercise = OrderExercise | SwapExercise;

/** Words a sentence must have, at least, to make an ordering card. */
const ORDER_MIN_WORDS = 3;

const VERB_ROLES = new Set(['aux', 'verb']);
const NEGATIONS = new Set(['not', "n't"]);

const MODULUS = 2147483647;

/** A small seeded generator (Park–Miller), so a card is the same on every render. */
function random(seed: number): () => number {
  let state = seed % MODULUS || 1;
  return () => {
    state = (state * 48271) % MODULUS;
    return state / MODULUS;
  };
}

/** A seed from a text (and a salt such as the card's place in the queue). */
export function seedOf(text: string, salt = 0): number {
  let hash = 7 + salt;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % MODULUS;
  }
  return hash;
}

/** The words shuffled; when that gives the same order, the first two swap. */
export function shuffleWords(words: readonly string[], seed: number): string[] {
  const next = random(seed);
  const out = [...words];
  for (let index = out.length - 1; index > 0; index -= 1) {
    const other = Math.floor(next() * (index + 1));
    [out[index], out[other]] = [out[other]!, out[index]!];
  }
  const same = out.every((word, index) => word === words[index]);
  const distinct = new Set(words).size > 1;
  if (same && distinct) {
    const swapAt = out.findIndex((word, index) => word !== out[index + 1]);
    [out[swapAt], out[swapAt + 1]] = [out[swapAt + 1]!, out[swapAt]!];
  }
  return out;
}

/** The verb block of a sentence: from its first aux/verb token, through aux, verb and `not`. */
export function verbSpan(
  tokens: readonly ApplyToken[],
): {start: number; end: number} | null {
  const start = tokens.findIndex(token => VERB_ROLES.has(token.role));
  if (start < 0) return null;
  let end = start + 1;
  while (
    end < tokens.length &&
    (VERB_ROLES.has(tokens[end]!.role) || NEGATIONS.has(tokens[end]!.t))
  ) {
    end += 1;
  }
  return {start, end};
}

const words = (tokens: readonly ApplyToken[]) =>
  tokens.map(token => token.t).join(' ');

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function orderExercise(
  sentence: ApplySentence,
  seed: number,
): OrderExercise | null {
  const answer = sentence.tokens.map(token => token.t);
  if (answer.length < ORDER_MIN_WORDS || new Set(answer).size < 2) {
    return null;
  }
  return {
    kind: 'order',
    sentenceId: sentence.id,
    promptVi: sentence.text_vi,
    answer,
    shuffled: shuffleWords(answer, seed),
    textEn: sentence.text_en,
  };
}

/**
 * A swap card from one set: a model and a target with another subject group
 * and the same polarity. Targets whose verb differs from the model's come
 * first, since copying the model would not show the change.
 */
export function swapExercise(
  set: readonly ApplySentence[],
  seed: number,
): SwapExercise | null {
  const pairs: Array<{model: ApplySentence; target: ApplySentence}> = [];
  for (const model of set) {
    const modelSpan = verbSpan(model.tokens);
    if (!modelSpan) continue;
    for (const target of set) {
      if (
        target.id === model.id ||
        target.subject_group === model.subject_group ||
        target.polarity !== model.polarity ||
        !verbSpan(target.tokens)
      ) {
        continue;
      }
      pairs.push({model, target});
    }
  }
  if (pairs.length === 0) return null;
  const blankOf = (sentence: ApplySentence) => {
    const span = verbSpan(sentence.tokens)!;
    return words(sentence.tokens.slice(span.start, span.end));
  };
  const differing = pairs.filter(
    pair => blankOf(pair.model) !== blankOf(pair.target),
  );
  const pool = differing.length > 0 ? differing : pairs;
  const {model, target} = pool[Math.floor(random(seed)() * pool.length)]!;
  const span = verbSpan(target.tokens)!;
  return {
    kind: 'swap',
    sentenceId: target.id,
    model: model.text_en,
    subject: target.subject_text,
    promptVi: target.text_vi,
    before: capitalise(words(target.tokens.slice(0, span.start))),
    after: words(target.tokens.slice(span.end)),
    answer: blankOf(target),
    textEn: target.text_en,
  };
}

/**
 * The card for a stage-4 item from its sets (newest first), or null when no
 * opened set gives one; the screen then asks it at stage 2 (recall). An odd
 * seed tries a swap first, an even one an ordering.
 */
export function buildApplyExercise(
  sets: readonly (readonly ApplySentence[])[],
  seed: number,
): ApplyExercise | null {
  const swap = () => {
    for (const set of sets) {
      const exercise = swapExercise(set, seed);
      if (exercise) return exercise;
    }
    return null;
  };
  const order = () => {
    const sentences = sets.flat();
    if (sentences.length === 0) return null;
    const start = seed % sentences.length;
    for (let offset = 0; offset < sentences.length; offset += 1) {
      const sentence = sentences[(start + offset) % sentences.length]!;
      const exercise = orderExercise(sentence, seed);
      if (exercise) return exercise;
    }
    return null;
  };
  return seed % 2 === 1 ? (swap() ?? order()) : (order() ?? swap());
}

/** Lower case, one space, contractions spelled out (`hasn't` = `has not`). */
export function normaliseAnswer(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\bcan't\b/g, 'cannot')
    .replace(/\bwon't\b/g, 'will not')
    .replace(/n't\b/g, ' not')
    .replace(/\bcannot\b/g, 'can not')
    .replace(/[^a-z' ]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function isOrderCorrect(
  exercise: OrderExercise,
  picked: readonly string[],
): boolean {
  return (
    picked.length === exercise.answer.length &&
    picked.every((word, index) => word === exercise.answer[index])
  );
}

export function isSwapCorrect(exercise: SwapExercise, typed: string): boolean {
  return normaliseAnswer(typed) === normaliseAnswer(exercise.answer);
}
