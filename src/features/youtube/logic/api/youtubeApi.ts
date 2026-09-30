import {getAppConfig} from '@core/api/appConfig';
import {authenticatedFetch} from '@core/api/authenticatedFetch';
import {createRequestId} from '@core/api/requestId';
import i18n from '@core/i18n';
import {
  CreateYouTubeTranscriptResponseSchema,
  type RawCue,
  validateGetYouTubeTranscriptResponse,
  type YouTubeErrorCode,
  type YouTubeTranscript,
} from '@core/schemas/youtube-transcript-v1';

const POLL_INTERVAL_MS = 1_000;
// SETE-325: transcript + analysis for content-heavy videos regularly needs
// more than 75s backend-side, so give the job a full 120s before surfacing
// `errors.youtube_timeout`.
const POLL_DEADLINE_MS = 120_000;
const FETCH_TIMEOUT_MS = 10_000;

export type YouTubeJobProgress = {percent: number; stage: string | null};
export type YouTubeJobResult =
  | {ok: true; lesson: YouTubeTranscript}
  | {ok: false; cancelled: true}
  | {
      ok: false;
      errorCode: YouTubeErrorCode | 'NETWORK_ERROR' | 'YOUTUBE_UNAUTHORIZED';
      message: string;
    };

const YOUTUBE_WATCH_HOSTS = new Set([
  'youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
]);

function videoIdFromYouTubeWatchUrl(url: URL): string | null {
  if (url.pathname === '/watch') {
    return url.searchParams.get('v');
  }
  if (/^\/(shorts|embed)\//.test(url.pathname)) {
    return url.pathname.split('/')[2] ?? null;
  }
  return null;
}

export function parseYouTubeVideoId(value: string): string | null {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    let id: string | null = null;
    if (host === 'youtu.be') {
      id = url.pathname.slice(1).split('/')[0] ?? null;
    } else if (YOUTUBE_WATCH_HOSTS.has(host)) {
      id = videoIdFromYouTubeWatchUrl(url);
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function errorMessage(code: string): string {
  const normalized = code.toLowerCase();
  const key = normalized.startsWith('youtube_')
    ? `errors.youtube_${normalized.slice('youtube_'.length)}`
    : normalized.startsWith('transcript_')
    ? `errors.${normalized}`
    : `errors.${normalized}`;
  const translated = i18n.t(key);
  return translated === key ? i18n.t('errors.youtube_failed') : translated;
}

function isAborted(signal?: AbortSignal): boolean {
  return signal?.aborted === true;
}

const cancelledResult = (): YouTubeJobResult => ({ok: false, cancelled: true});

// Client-only (not part of the backend-mirroring YouTubeErrorCodeSchema): the
// backend rejected the call with 401 even after authenticatedFetch attached
// the session token and retried a refresh, so the user must sign in again.
const unauthorizedResult = (): YouTubeJobResult => ({
  ok: false,
  errorCode: 'YOUTUBE_UNAUTHORIZED',
  message: i18n.t('errors.youtube_auth_required'),
});

/**
 * Bounds a single fetch call so a hung request can't outlive the overall
 * poll deadline. The returned signal aborts when either the caller's own
 * `externalSignal` aborts (user cancellation) or `timeoutMs` elapses
 * (internal watchdog) — callers distinguish the two after the fact by
 * checking whether `externalSignal` itself is aborted.
 */
function withTimeout(
  timeoutMs: number,
  externalSignal: AbortSignal | undefined,
): {signal: AbortSignal; cleanup: () => void} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort, {once: true});
  const cleanup = () => {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  };
  return {signal: controller.signal, cleanup};
}

function wait(ms: number, signal?: AbortSignal): Promise<boolean> {
  return new Promise(resolve => {
    if (signal?.aborted) return resolve(false);
    const timer = setTimeout(() => resolve(true), ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve(false);
      },
      {once: true},
    );
  });
}

type WaitOutcome = 'continue' | 'cancelled' | 'timeout';

/**
 * Waits up to `ms` (clamped to the remaining time before `deadline`) before
 * the next poll attempt. Every caller in the polling loop needs the same
 * "did the deadline already pass / did the caller cancel" decision, so this
 * is the single place that makes it.
 */
async function waitBeforeNextAttempt(
  ms: number,
  deadline: number,
  signal?: AbortSignal,
): Promise<WaitOutcome> {
  if (Date.now() >= deadline) {
    return 'timeout';
  }
  const clamped = Math.min(ms, deadline - Date.now());
  const completed = await wait(clamped, signal);
  return completed ? 'continue' : 'cancelled';
}

function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function runYouTubeJob(
  url: string,
  cues?: RawCue[],
  onProgress?: (progress: YouTubeJobProgress) => void,
  signal?: AbortSignal,
): Promise<YouTubeJobResult> {
  if (isAborted(signal)) return cancelledResult();
  const {apiBaseUrl} = getAppConfig();
  const deadline = Date.now() + POLL_DEADLINE_MS;
  let response: Response;
  try {
    const {signal: fetchSignal, cleanup} = withTimeout(
      Math.min(FETCH_TIMEOUT_MS, deadline - Date.now()),
      signal,
    );
    try {
      response = await authenticatedFetch(
        `${apiBaseUrl}/v1/youtube/transcripts`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Idempotency-Key': createRequestId(),
          },
          body: JSON.stringify(cues ? {url, transcript: {cues}} : {url}),
          signal: fetchSignal,
        },
      );
    } finally {
      cleanup();
    }
  } catch {
    if (isAborted(signal)) return cancelledResult();
    return {
      ok: false,
      errorCode: 'NETWORK_ERROR',
      message: i18n.t('errors.network_lost'),
    };
  }
  if (isAborted(signal)) return cancelledResult();
  if (response.status === 401) return unauthorizedResult();
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (isAborted(signal)) return cancelledResult();
    return {
      ok: false,
      errorCode: 'NETWORK_ERROR',
      message: i18n.t('errors.network_lost'),
    };
  }
  const parsedCreated = CreateYouTubeTranscriptResponseSchema.safeParse(body);
  if (!response.ok || !parsedCreated.success) {
    const error =
      (body as {error?: {code?: string}})?.error?.code ?? 'YOUTUBE_FAILED';
    return {
      ok: false,
      errorCode: error as YouTubeErrorCode,
      message: errorMessage(error),
    };
  }
  onProgress?.(parsedCreated.data.progress);
  while (Date.now() < deadline) {
    const waitOutcome = await waitBeforeNextAttempt(
      POLL_INTERVAL_MS,
      deadline,
      signal,
    );
    if (waitOutcome === 'cancelled') return cancelledResult();
    if (waitOutcome === 'timeout') break;
    try {
      const {signal: fetchSignal, cleanup} = withTimeout(
        Math.min(FETCH_TIMEOUT_MS, deadline - Date.now()),
        signal,
      );
      try {
        response = await authenticatedFetch(
          `${apiBaseUrl}/v1/youtube/transcripts/${parsedCreated.data.job_id}`,
          {headers: {Accept: 'application/json'}, signal: fetchSignal},
        );
      } finally {
        cleanup();
      }
    } catch {
      if (isAborted(signal)) return cancelledResult();
      continue;
    }
    if (isAborted(signal)) return cancelledResult();
    if (response.status === 401) return unauthorizedResult();

    if (!response.ok && isTransientStatus(response.status)) {
      continue;
    }
    try {
      body = await response.json();
    } catch {
      if (isAborted(signal)) return cancelledResult();
      continue;
    }
    const status = validateGetYouTubeTranscriptResponse(body);
    if (!status.valid)
      return {
        ok: false,
        errorCode: 'NETWORK_ERROR',
        message: i18n.t('errors.youtube_failed'),
      };
    onProgress?.(status.data.progress);
    if (status.data.status === 'completed' && status.data.data)
      return {ok: true, lesson: status.data.data};
    if (status.data.status === 'failed' && status.data.error)
      return {
        ok: false,
        errorCode: status.data.error.code,
        message: errorMessage(status.data.error.code),
      };
  }
  return {
    ok: false,
    errorCode: 'NETWORK_ERROR',
    message: i18n.t('errors.youtube_timeout'),
  };
}
