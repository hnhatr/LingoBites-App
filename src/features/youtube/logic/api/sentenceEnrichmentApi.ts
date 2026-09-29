import {z} from 'zod';
import {getAppConfig} from '@core/api/appConfig';
import {authenticatedFetch} from '@core/api/authenticatedFetch';
import type {SentenceEnrichment} from '@core/schemas/sentence-contract';
import type {SentenceBlockId} from '../sentence/sentencePipeline';

const VocabEntrySchema = z.object({
  word: z.string(),
  pos: z.string(),
  ipa: z.string(),
  meaning: z.string(),
  tip: z.string().optional(),
  inSentenceNote: z.string().optional(),
});

const GrammarPointSchema = z.object({
  name: z.string(),
  description: z.string(),
  formula: z.string(),
  analysis: z.string(),
});

export const SentenceEnrichmentSchema = z.object({
  keyWord: z.string().nullable(),
  vocab: z.array(VocabEntrySchema),
  grammar: z.array(GrammarPointSchema),
  status: z.enum(['pending', 'partial', 'ready', 'failed']),
  error: z.string().nullable().optional(),
});

export const LessonEnrichmentSchema = z.record(
  z.coerce.number(),
  SentenceEnrichmentSchema,
);

export function buildSegmentEnrichmentUrl(
  videoId: string,
  segmentIndex: number,
  apiBaseUrl: string,
): string {
  return (
    `${apiBaseUrl}/v1/youtube/transcripts/${encodeURIComponent(videoId)}` +
    `/segments/${segmentIndex}/enrichment`
  );
}

export function buildLessonEnrichmentUrl(
  videoId: string,
  apiBaseUrl: string,
): string {
  return `${apiBaseUrl}/v1/youtube/transcripts/${encodeURIComponent(
    videoId,
  )}/enrichment`;
}

/**
 * SETE-329 (TASK-2): per-block retry for one sentence card.
 *
 * Retries exactly one AI block (`keyword` | `vocab` | `grammar`) of one
 * segment. The backend (SETE-323 BTASK-1–3) serves enrichment through the
 * `youtubeWorker` cache keyed by `videoId`, so the retry path addresses the
 * segment inside that cached lesson. If the backend route ever moves, only
 * `buildRetryUrl` changes — the hook, card, and tests talk to
 * `retrySentenceBlock`, never to the URL.
 */
export function buildRetryUrl(
  videoId: string,
  segmentIndex: number,
  apiBaseUrl: string,
): string {
  return (
    `${apiBaseUrl}/v1/youtube/transcripts/${encodeURIComponent(videoId)}` +
    `/segments/${segmentIndex}/enrichment:retry`
  );
}

export type FetchSegmentEnrichmentArgs = {
  videoId: string;
  segmentIndex: number;
  signal?: AbortSignal;
};

export type FetchSegmentEnrichmentResult =
  | {ok: true; enrichment: SentenceEnrichment}
  | {ok: false; message: string};

export async function fetchSegmentEnrichment(
  args: FetchSegmentEnrichmentArgs,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchSegmentEnrichmentResult> {
  const {apiBaseUrl} = getAppConfig();
  let response: Response;
  try {
    response = await authenticatedFetch(
      buildSegmentEnrichmentUrl(args.videoId, args.segmentIndex, apiBaseUrl),
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: args.signal,
      },
      fetchImpl,
    );
  } catch (error) {
    if (args.signal?.aborted) {
      return {ok: false, message: 'cancelled'};
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'NETWORK_ERROR',
    };
  }
  if (args.signal?.aborted) {
    return {ok: false, message: 'cancelled'};
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {ok: false, message: 'NETWORK_ERROR'};
  }
  const parsed = SentenceEnrichmentSchema.safeParse(body);
  if (!response.ok || !parsed.success) {
    const code =
      (body as {error?: {code?: string}})?.error?.code ?? 'FETCH_FAILED';
    return {ok: false, message: code};
  }
  return {ok: true, enrichment: parsed.data};
}

export type FetchLessonEnrichmentArgs = {
  videoId: string;
  signal?: AbortSignal;
};

export type FetchLessonEnrichmentResult =
  | {ok: true; enrichments: Record<number, SentenceEnrichment>}
  | {ok: false; message: string};

export async function fetchLessonEnrichment(
  args: FetchLessonEnrichmentArgs,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchLessonEnrichmentResult> {
  const {apiBaseUrl} = getAppConfig();
  let response: Response;
  try {
    response = await authenticatedFetch(
      buildLessonEnrichmentUrl(args.videoId, apiBaseUrl),
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: args.signal,
      },
      fetchImpl,
    );
  } catch (error) {
    if (args.signal?.aborted) {
      return {ok: false, message: 'cancelled'};
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'NETWORK_ERROR',
    };
  }
  if (args.signal?.aborted) {
    return {ok: false, message: 'cancelled'};
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {ok: false, message: 'NETWORK_ERROR'};
  }
  const rawData =
    body && typeof body === 'object' && 'enrichments' in body
      ? (body as {enrichments: unknown}).enrichments
      : body;

  const parsed = LessonEnrichmentSchema.safeParse(rawData);
  if (!response.ok || !parsed.success) {
    const code =
      (body as {error?: {code?: string}})?.error?.code ?? 'FETCH_FAILED';
    return {ok: false, message: code};
  }
  return {ok: true, enrichments: parsed.data};
}

export type RetrySentenceBlockArgs = {
  videoId: string;
  segmentIndex: number;
  block: SentenceBlockId;
  signal?: AbortSignal;
};

export type RetrySentenceBlockResult =
  | {ok: true; enrichment: SentenceEnrichment}
  | {ok: false; message: string};

export async function retrySentenceBlock(
  args: RetrySentenceBlockArgs,
  fetchImpl: typeof fetch = fetch,
): Promise<RetrySentenceBlockResult> {
  const {apiBaseUrl} = getAppConfig();
  let response: Response;
  try {
    response = await authenticatedFetch(
      buildRetryUrl(args.videoId, args.segmentIndex, apiBaseUrl),
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({block: args.block}),
        signal: args.signal,
      },
      fetchImpl,
    );
  } catch (error) {
    if (args.signal?.aborted) {
      return {ok: false, message: 'cancelled'};
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'NETWORK_ERROR',
    };
  }
  if (args.signal?.aborted) {
    return {ok: false, message: 'cancelled'};
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {ok: false, message: 'NETWORK_ERROR'};
  }
  const parsed = SentenceEnrichmentSchema.safeParse(body);
  if (!response.ok || !parsed.success) {
    const code =
      (body as {error?: {code?: string}})?.error?.code ?? 'RETRY_FAILED';
    return {ok: false, message: code};
  }
  return {ok: true, enrichment: parsed.data};
}
