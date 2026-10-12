/**
 * Vocab path P5: the word path and word packs on the Server (`GET /v1/word-path`,
 * `GET /v1/word-packs/:id`, `POST /v1/word-packs/:id/learn`). Responses are
 * checked with zod before anything is stored; failures come back as values, not
 * throws. Nothing is written here: `wordPackRepository` stores a downloaded pack.
 */
import {z} from 'zod';

import {getAppConfig} from '@core/api/appConfig';
import {authenticatedFetch} from '@core/api/authenticatedFetch';
import {isNetworkFailure} from '@core/api/connectivity';
import {type CatalogItem, CatalogItemSchema} from '@core/schemas/lesson';

export const WordPackSummarySchema = z.object({
  id: z.string().uuid(),
  position: z.number().int(),
  title_vi: z.string(),
  item_count: z.number().int(),
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
    id: z.string().uuid(),
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

export type WordPathErrorKind =
  | 'network-error'
  | 'not-found'
  | 'client-error'
  | 'server-error'
  | 'contract-mismatch';

export type WordPathError = {
  ok: false;
  kind: WordPathErrorKind;
  message: string;
};

export type WordPathResult<T> = {ok: true; value: T} | WordPathError;

export type WordPathClientOptions = {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

async function send<T>(
  schema: z.ZodType<T>,
  path: string,
  init: RequestInit,
  options: WordPathClientOptions,
): Promise<WordPathResult<T>> {
  const {apiBaseUrl} = getAppConfig();
  let response: Response;
  try {
    response = await authenticatedFetch(
      `${apiBaseUrl}${path}`,
      {
        headers: {Accept: 'application/json', ...init.headers},
        signal: options.signal,
        ...init,
      },
      options.fetchImpl,
    );
  } catch (error) {
    if (options.signal?.aborted) {
      return {ok: false, kind: 'network-error', message: 'cancelled'};
    }
    return {
      ok: false,
      kind: isNetworkFailure(error) ? 'network-error' : 'server-error',
      message: 'The server could not be reached.',
    };
  }
  if (response.status === 404) {
    return {ok: false, kind: 'not-found', message: 'Word pack not found.'};
  }
  if (!response.ok) {
    return {
      ok: false,
      kind: response.status >= 500 ? 'server-error' : 'client-error',
      message: `The request failed (${response.status}).`,
    };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {ok: false, kind: 'contract-mismatch', message: 'Unreadable body.'};
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {ok: false, kind: 'contract-mismatch', message: 'Unexpected body.'};
  }
  return {ok: true, value: parsed.data};
}

export function fetchWordPath(options: WordPathClientOptions = {}) {
  return send(WordPathSchema, '/v1/word-path', {method: 'GET'}, options);
}

export function fetchWordPack(
  packId: string,
  options: WordPathClientOptions = {},
): Promise<WordPathResult<WordPackDetail>> {
  return send(
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
  return send(
    LearnResultSchema,
    `/v1/word-packs/${encodeURIComponent(packId)}/learn`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({item_codes: input.itemCodes, mode: input.mode}),
    },
    options,
  );
}

export type {CatalogItem};
