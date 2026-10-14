/**
 * Vocab path P5: the word path and word packs on the Server (`GET /v1/word-path`,
 * `GET /v1/word-packs/:id`, `POST /v1/word-packs/:id/learn`). Responses are
 * checked with zod before anything is stored; failures come back as values, not
 * throws. Nothing is written here: `wordPackRepository` stores a downloaded pack.
 */
import {z} from 'zod';

import {
  type ApiFailure,
  type ApiResult,
  jsonBody,
  type JsonRequestOptions,
  requestJson,
} from '@core/api/jsonRequest';
import {CatalogItemSchema} from '@core/schemas/lesson';

export const WordPackSummarySchema = z.object({
  id: z.string().guid(),
  position: z.number().int(),
  title_vi: z.string(),
  item_count: z.number().int(),
  /** How many items are of each kind; absent from older Servers. */
  kind_counts: z
    .object({
      word: z.number().int(),
      phrase: z.number().int(),
      pattern: z.number().int(),
      grammar: z.number().int(),
    })
    .optional(),
  /** The pack's first items; absent from older Servers. */
  preview: z
    .array(z.object({text: z.string(), meaning_vi: z.string()}))
    .optional(),
  /** The pack's cover picture; absent from older Servers. */
  cover_url: z.string().nullable().optional(),
});

export const WordPathSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  levels: z.array(
    z.object({
      cefr_level: z.string(),
      topics: z.array(
        z.object({
          topic_code: z.string().nullable(),
          title_vi: z.string(),
          packs: z.array(WordPackSummarySchema),
        }),
      ),
    }),
  ),
});

export const WordPackDetailSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  pack: z.object({
    id: z.string().guid(),
    cefr_level: z.string(),
    topic_code: z.string().nullable(),
    position: z.number().int(),
    title_vi: z.string(),
  }),
  items: z.array(CatalogItemSchema),
});

export const LearnResultSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  enrolled: z.number().int(),
  already_scheduled: z.number().int(),
});

export type WordPath = z.infer<typeof WordPathSchema>;
export type WordPackSummary = z.infer<typeof WordPackSummarySchema>;
export type WordPackDetail = z.infer<typeof WordPackDetailSchema>;
export type LearnMode = 'learn' | 'known';

export type WordPathError = ApiFailure;

export type WordPathResult<T> = ApiResult<T>;

export type WordPathClientOptions = JsonRequestOptions;

export function fetchWordPath(options: WordPathClientOptions = {}) {
  return requestJson(WordPathSchema, '/v1/word-path', {method: 'GET'}, options);
}

export function fetchWordPack(
  packId: string,
  options: WordPathClientOptions = {},
): Promise<WordPathResult<WordPackDetail>> {
  return requestJson(
    WordPackDetailSchema,
    `/v1/word-packs/${encodeURIComponent(packId)}`,
    {method: 'GET'},
    options,
  );
}

export function learnWordPack(
  packId: string,
  input: {itemCodes: string[]; mode: LearnMode},
  options: WordPathClientOptions = {},
) {
  return requestJson(
    LearnResultSchema,
    `/v1/word-packs/${encodeURIComponent(packId)}/learn`,
    jsonBody({item_codes: input.itemCodes, mode: input.mode}),
    options,
  );
}
