import type {ItemKind} from './catalogItem';

/**
 * Learning item identity: the catalog item code, `kind:body`, e.g.
 * `word:coffee`, `phrase:wake up`, `pattern:can-i-have` (see `./itemCode`).
 *
 * The rules mirror the Server's `normalizeItemKey` and are pinned by the same
 * fixture (`__tests__/fixtures/learning-item-keys.json`, byte-identical to
 * `LingoBites-Server/test/fixtures/learning-item-keys.json`). Change both
 * together, or a saved card would stop matching its lesson item.
 */
export type LearningItemKind = ItemKind;

/**
 * Lowercase, NFKC, curly apostrophes to `'`, collapsed whitespace, and no
 * leading/trailing punctuation. Inner punctuation (`well-known`, `don't`) stays.
 */
export function normalizeItemKey(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/[‘’ʼ]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .trim();
}

/** A vocabulary key with whitespace is a phrase, otherwise a word. */
export function vocabularyKind(itemKey: string): 'word' | 'phrase' {
  return /\s/.test(itemKey) ? 'phrase' : 'word';
}

/** `word:coffee` / `phrase:wake up`, or `null` when nothing usable remains. */
export function vocabularyItemKey(word: string): string | null {
  const key = normalizeItemKey(word);
  return key === '' ? null : `${vocabularyKind(key)}:${key}`;
}
