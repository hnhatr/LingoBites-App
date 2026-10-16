import {useEffect, useState} from 'react';
import {z} from 'zod';

import {
  type ApiResult,
  jsonBody,
  type JsonRequestOptions,
  requestJson,
} from '@core/api/jsonRequest';

/**
 * Vocab path P6 (F8): the word-list items behind the words of a learner's own
 * lesson (`POST /v1/items/lookup`), so the analysis can show each word's CEFR
 * level and "Thêm vào lộ trình". Looked up when the analysis is shown, kept
 * for the session; without a network the words simply show no level.
 */

export const WordListMatchSchema = z.object({
  code: z.string(),
  kind: z.string(),
  text: z.string(),
  cefr_level: z.string().nullable(),
  meaning_vi: z.string(),
  part_of_speech: z.string().nullable(),
});

export const WordLookupSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  results: z.array(
    z.object({word: z.string(), matches: z.array(WordListMatchSchema)}),
  ),
});

export type WordListMatch = z.infer<typeof WordListMatchSchema>;

/** The Server takes at most this many words per lookup. */
export const LOOKUP_WORDS_MAX = 30;

export function lookupWords(
  words: ReadonlyArray<{word: string; pos: string | null}>,
  options: JsonRequestOptions = {},
): Promise<ApiResult<z.infer<typeof WordLookupSchema>>> {
  return requestJson(
    WordLookupSchema,
    '/v1/items/lookup',
    jsonBody({words: words.slice(0, LOOKUP_WORDS_MAX)}),
    options,
  );
}

type Word = {id: string; word: string; pos: string};

const cache = new Map<string, WordListMatch[]>();

function cacheKey(word: Word): string {
  return `${word.word.toLowerCase()}|${word.pos.toLowerCase()}`;
}

/** Forgets the session cache (tests). */
export function clearWordListCache(): void {
  cache.clear();
}

/**
 * The matches of each analysed word, by the word's id. Empty while loading,
 * when disabled (lessons that are not the learner's own) and when offline.
 */
export function useWordListMatches(
  words: readonly Word[],
  enabled: boolean,
): ReadonlyMap<string, WordListMatch[]> {
  const [, setVersion] = useState(0);
  const key = words.map(cacheKey).join('\n');

  useEffect(() => {
    if (!enabled) return;
    const missing = words.filter(word => !cache.has(cacheKey(word)));
    if (missing.length === 0) return;
    let alive = true;
    lookupWords(missing.map(word => ({word: word.word, pos: word.pos}))).then(
      result => {
        if (!result.ok) return;
        result.value.results.forEach((entry, index) => {
          const word = missing[index];
          if (word) cache.set(cacheKey(word), entry.matches);
        });
        if (alive) setVersion(version => version + 1);
      },
    );
    return () => {
      alive = false;
    };
    // `key` stands for the words.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);

  const out = new Map<string, WordListMatch[]>();
  if (!enabled) return out;
  for (const word of words) {
    const matches = cache.get(cacheKey(word));
    if (matches && matches.length > 0) out.set(word.id, matches);
  }
  return out;
}
