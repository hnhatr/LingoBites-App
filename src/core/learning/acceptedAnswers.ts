// COPY of the Server's `src/modules/items/model/acceptedAnswers.ts` (keep all
// three copies in sync through `__tests__/fixtures/accepted-answers.json`).
import type {PatternPayload} from './itemPayload';
import {expandPattern, parseFrame} from './patternFrame';

/**
 * Accepted answers of a sentence pattern: every sentence its frame and its
 * variants produce over the slot values. Nothing is stored per activity, so an
 * item edit changes what is accepted everywhere at once.
 */

export const ACCEPTED_ANSWERS_LIMIT = 200;

/**
 * Comparison form of an answer: NFKC, curly → straight apostrophes,
 * lowercase, single spaces and no surrounding punctuation.
 */
export function normalizeAnswer(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[‘’ʼ]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .trim();
}

type Pattern = {text: string; payload: PatternPayload};

function unique(sentences: string[], limit: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const sentence of sentences) {
    const key = normalizeAnswer(sentence);
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    result.push(key);
    if (result.length >= limit) break;
  }
  return result;
}

/** Every normalised sentence of the frame and its variants, frame first. */
export function acceptedAnswers(
  pattern: Pattern,
  variants: ReadonlyArray<{text: string}>,
  resolveRef: (code: string) => string | null,
  limit = ACCEPTED_ANSWERS_LIMIT,
): string[] {
  const frames = [pattern.text, ...variants.map(variant => variant.text)];
  return unique(
    frames.flatMap(frame =>
      expandPattern(frame, pattern.payload.slots, resolveRef, limit),
    ),
    limit,
  );
}

/**
 * Accepted answers for one combination of slot values (a speaking drill
 * prompt): the frame and each variant filled with exactly those values.
 * A frame that misses a value, or names a slot without one, is skipped.
 */
export function acceptedForValues(
  pattern: Pattern,
  variants: ReadonlyArray<{text: string}>,
  values: Readonly<Record<string, string>>,
): string[] {
  const frames = [pattern.text, ...variants.map(variant => variant.text)];
  const sentences = frames.flatMap(frame => {
    const parsed = parseFrame(frame);
    if (!parsed.ok) return [];
    if (parsed.slotNames.some(name => values[name] === undefined)) return [];
    return [
      parsed.segments
        .map(segment =>
          segment.type === 'text' ? segment.value : values[segment.name]!,
        )
        .join(''),
    ];
  });
  return unique(sentences, ACCEPTED_ANSWERS_LIMIT);
}
