import type {AnalysisVocabularyItem} from '@core/schemas/lesson';

/**
 * IPA display helpers for the YouTube study card.
 *
 * Stored IPA marks primary stress with an ASCII apostrophe (`t'ɔs`); the
 * card shows the standard stress mark (`tˈɔs`) and, when the sentence and
 * its IPA have the same number of words, pairs each word with its own
 * transcription so it can sit right under the word.
 */

export type WordWithIpa = {
  word: string;
  ipa: string | null;
};

/** Standard stress marks and single spaces; transcription is unchanged. */
export function normalizeIpa(ipa: string): string {
  return ipa.replace(/['’]/g, 'ˈ').replace(/\s+/g, ' ').trim();
}

/** Sentence split into words as written (punctuation stays on the word). */
export function splitSentenceWords(text: string): string[] {
  const trimmed = text.trim();
  return trimmed.length === 0 ? [] : trimmed.split(/\s+/);
}

/**
 * Each word with its IPA token, or null when the word counts differ and
 * the card has to fall back to the whole-sentence IPA line.
 */
export function pairWordsWithIpa(
  text: string,
  ipa: string | null | undefined,
): WordWithIpa[] | null {
  const words = splitSentenceWords(text);
  const tokens = ipa ? normalizeIpa(ipa).split(' ').filter(Boolean) : [];
  if (words.length === 0 || words.length !== tokens.length) {
    return null;
  }
  return words.map((word, index) => ({word, ipa: tokens[index]}));
}

/** Lower-case word without the punctuation around it ("Teams." -> "teams"). */
export function wordLookupKey(word: string): string {
  return word
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

/**
 * The analysed vocabulary entry for a tapped word: an exact match first,
 * else an entry the word is an inflection of ("teams" -> "team").
 */
export function findVocabularyForWord(
  word: string,
  vocabulary: readonly AnalysisVocabularyItem[],
): AnalysisVocabularyItem | null {
  const key = wordLookupKey(word);
  if (key.length === 0) return null;
  const exact = vocabulary.find(item => wordLookupKey(item.word) === key);
  if (exact) return exact;
  return (
    vocabulary.find(item => {
      const base = wordLookupKey(item.word);
      return (
        base.length >= 3 &&
        key.startsWith(base) &&
        key.length - base.length <= 3
      );
    }) ?? null
  );
}

/** The word as written, without the punctuation around it ("Teams." -> "Teams"). */
export function bareWord(word: string): string {
  return word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

/** IPA without wrapping slashes or brackets ("/tim/" -> "tim"). */
export function stripIpaDelimiters(ipa: string): string {
  return ipa.trim().replace(/^[/[]+|[/\]]+$/g, '');
}
