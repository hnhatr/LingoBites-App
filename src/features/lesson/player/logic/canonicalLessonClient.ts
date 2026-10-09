/**
 * Canonical lesson API client (LING-149 TASK-007, AD-005/AD-007/AD-009).
 *
 * Follows the per-domain convention in `src/core/api/*Client.ts`
 * (`authenticatedFetch`, `getAppConfig`, injected `fetchImpl`,
 * `AbortSignal`) but lives under `src/features/lesson/player` so the
 * shared layer never depends on a feature module. Exact learner routes:
 * `GET /api/v1/lessons`, `GET /api/v1/lessons/:id`,
 * `POST /api/v1/lessons/:id/sentences/:sentenceId/analysis`,
 * `POST /api/v1/lessons/revisions`, `POST /api/v1/lesson-creations`,
 * `GET /api/v1/lesson-creations/:id`. The S4.3 compose routes reuse `send`
 * and `errorFromStatus` from `composeClient.ts`.
 *
 * No local persistence of any kind: this module imports no repository,
 * storage, or database code, and never writes responses anywhere. Downloads
 * validate the whole body with the strict zod mirror in
 * `src/core/schemas/lesson.ts` before the one-row SQLite swap (AD-005).
 */
import {getAppConfig} from '@core/api/appConfig';
import {authenticatedFetch} from '@core/api/authenticatedFetch';
import {
  type LearnerLessonCreationRequestBody,
  type LessonAnalysis,
  type LessonCatalogResponse,
  type LessonCreationStatusResponse,
  type LessonOrigin,
  type LessonRevisionItem,
  type LessonRevisionsResponse,
  type LessonSnapshot,
  type LessonSourceType,
  parseLessonAnalysisResponse,
  parseLessonCatalogResponse,
  parseLessonCreationAcceptedResponse,
  parseLessonCreationStatusResponse,
  parseLessonRevisionsResponse,
  parseLessonSnapshotResponse,
} from '@core/schemas/lesson';

const LESSONS_PATH = '/api/v1/lessons';
const LESSON_CREATIONS_PATH = '/api/v1/lesson-creations';

export type CanonicalLessonErrorKind =
  | 'not-found'
  | 'gone'
  | 'content-error'
  | 'analysis-busy'
  | 'analysis-failed'
  | 'idempotency-conflict'
  | 'contract-mismatch'
  | 'network-error'
  | 'auth-error'
  | 'server-error';

export type CanonicalLessonError = {
  ok: false;
  kind: CanonicalLessonErrorKind;
  errorCode: string;
  message: string;
  retryable: boolean;
  cancelled?: boolean;
  status?: number;
};

export type CanonicalLessonResult<T> =
  | {ok: true; value: T}
  | CanonicalLessonError;

export type CanonicalLessonClientOptions = {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function cancelledError(): CanonicalLessonError {
  return {
    ok: false,
    kind: 'network-error',
    errorCode: 'CANCELLED',
    message: 'Request cancelled.',
    retryable: false,
    cancelled: true,
  };
}

function networkError(): CanonicalLessonError {
  return {
    ok: false,
    kind: 'network-error',
    errorCode: 'NETWORK_ERROR',
    message: 'Network connection lost.',
    retryable: true,
  };
}

export function contentError(message: string): CanonicalLessonError {
  return {
    ok: false,
    kind: 'content-error',
    errorCode: 'INVALID_RESPONSE',
    message,
    retryable: false,
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function errorCodeOf(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const error = (body as {error?: unknown}).error;
  if (typeof error !== 'object' || error === null) return null;
  const code = (error as {code?: unknown}).code;
  return typeof code === 'string' ? code : null;
}

export function errorFromStatus(
  status: number,
  body: unknown,
  notFoundCode: string,
): CanonicalLessonError {
  const code =
    errorCodeOf(body) ?? (status === 404 ? notFoundCode : `HTTP_${status}`);
  const message =
    typeof body === 'object' && body !== null
      ? String(
          (body as {error?: {message?: unknown}}).error?.message ??
            'Request failed.',
        )
      : 'Request failed.';
  const base = {errorCode: code, message, status} as const;

  if (status === 401 || status === 403) {
    return {ok: false, kind: 'auth-error', ...base, retryable: false};
  }
  if (status === 404 || code === 'LESSON_NOT_FOUND') {
    return {ok: false, kind: 'not-found', ...base, retryable: false};
  }
  if (code === 'ANALYSIS_BUSY') {
    return {ok: false, kind: 'analysis-busy', ...base, retryable: true};
  }
  if (code === 'ANALYSIS_FAILED') {
    return {ok: false, kind: 'analysis-failed', ...base, retryable: true};
  }
  if (code === 'IDEMPOTENCY_CONFLICT') {
    return {ok: false, kind: 'idempotency-conflict', ...base, retryable: false};
  }
  if (
    code === 'LESSON_CONTENT_INVALID' ||
    code === 'LESSON_CONTRACT_MISMATCH'
  ) {
    return {ok: false, kind: 'content-error', ...base, retryable: false};
  }
  if (status >= 500 || status === 429) {
    return {ok: false, kind: 'server-error', ...base, retryable: true};
  }
  return {ok: false, kind: 'server-error', ...base, retryable: false};
}

export async function send(
  path: string,
  init: RequestInit,
  notFoundCode: string,
  options: CanonicalLessonClientOptions,
): Promise<{status: number; body: unknown} | CanonicalLessonError> {
  if (options.signal?.aborted) return cancelledError();
  const {apiBaseUrl} = getAppConfig();
  let response: Response;
  try {
    response = await authenticatedFetch(
      `${apiBaseUrl}${path}`,
      {headers: {Accept: 'application/json'}, signal: options.signal, ...init},
      options.fetchImpl,
    );
  } catch (error) {
    return isAbortError(error) || options.signal?.aborted
      ? cancelledError()
      : networkError();
  }
  return {status: response.status, body: await readJson(response)};
}

/** List the lessons visible to the caller (catalog). */
export async function fetchLessonCatalog(
  query: {
    limit?: number;
    cursor?: string;
    /** Narrow to one origin (`admin` = public lessons). */
    origin?: LessonOrigin;
    /** Narrow to one source type (e.g. `youtube`). */
    sourceType?: LessonSourceType;
  } = {},
  options: CanonicalLessonClientOptions = {},
): Promise<CanonicalLessonResult<LessonCatalogResponse>> {
  const params = new URLSearchParams();
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.cursor !== undefined) params.set('cursor', query.cursor);
  if (query.origin !== undefined) params.set('origin', query.origin);
  if (query.sourceType !== undefined) {
    params.set('source_type', query.sourceType);
  }
  // Lesson-card fields (duration, exercise count); older servers ignore it.
  params.set('include', 'card_meta');
  const suffix = params.size > 0 ? `?${params.toString()}` : '';
  const answered = await send(
    `${LESSONS_PATH}${suffix}`,
    {method: 'GET'},
    'LESSON_NOT_FOUND',
    options,
  );
  if (!('body' in answered)) return answered;
  const {status, body} = answered;
  if (status < 200 || status >= 300) {
    return errorFromStatus(status, body, 'LESSON_NOT_FOUND');
  }
  const parsed = parseLessonCatalogResponse(body);
  if (!parsed.ok) return contentError(parsed.message);
  return {ok: true, value: parsed.response};
}

/**
 * Read one versioned snapshot — the exact body a download stores verbatim
 * (AD-005). Every canonical source (learner text/OCR/YouTube, admin-created)
 * opens the same player from this body.
 */
export async function fetchLessonSnapshot(
  lessonId: string,
  options: CanonicalLessonClientOptions = {},
): Promise<
  CanonicalLessonResult<{snapshot: LessonSnapshot; rawBody: unknown}>
> {
  const answered = await send(
    `${LESSONS_PATH}/${encodeURIComponent(lessonId)}`,
    {method: 'GET'},
    'LESSON_NOT_FOUND',
    options,
  );
  if (!('body' in answered)) return answered;
  const {status, body} = answered;
  if (status < 200 || status >= 300) {
    return errorFromStatus(status, body, 'LESSON_NOT_FOUND');
  }
  const parsed = parseLessonSnapshotResponse(body);
  if (!parsed.ok) return contentError(parsed.message);
  return {ok: true, value: {snapshot: parsed.response.lesson, rawBody: body}};
}

/**
 * Fetch (or generate once, server-side) the analysis for one sentence
 * version. Returns the stored analysis; a 503 `ANALYSIS_BUSY` is retryable
 * and the caller keeps showing the downloaded copy. No request body is sent:
 * the Server answers 400 when a JSON content-type arrives with an empty
 * body.
 */
export async function fetchSentenceAnalysis(
  lessonId: string,
  sentenceId: string,
  options: CanonicalLessonClientOptions = {},
): Promise<CanonicalLessonResult<LessonAnalysis>> {
  const answered = await send(
    `${LESSONS_PATH}/${encodeURIComponent(
      lessonId,
    )}/sentences/${encodeURIComponent(sentenceId)}/analysis`,
    {method: 'POST'},
    'LESSON_NOT_FOUND',
    options,
  );
  if (!('body' in answered)) return answered;
  const {status, body} = answered;
  if (status < 200 || status >= 300) {
    return errorFromStatus(status, body, 'LESSON_NOT_FOUND');
  }
  const parsed = parseLessonAnalysisResponse(body);
  if (!parsed.ok) return contentError(parsed.message);
  return {ok: true, value: parsed.response.analysis};
}

export type LessonDownloadStatus =
  | {lessonId: string; state: 'current'; contentRevision: number | null}
  | {lessonId: string; state: 'gone'};

/**
 * Download status check (AD-007). `gone` is only trusted on HTTP 200 with an
 * explicit `gone` item; network errors, 401 and 5xx keep the local copy and
 * surface here as errors, never as deletions.
 */
export async function fetchLessonRevisions(
  lessonIds: string[],
  options: CanonicalLessonClientOptions = {},
): Promise<CanonicalLessonResult<LessonDownloadStatus[]>> {
  const answered = await send(
    `${LESSONS_PATH}/revisions`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({lesson_ids: lessonIds}),
    },
    'LESSON_NOT_FOUND',
    options,
  );
  if (!('body' in answered)) return answered;
  const {status, body} = answered;
  if (status < 200 || status >= 300) {
    return errorFromStatus(status, body, 'LESSON_NOT_FOUND');
  }
  const parsed = parseLessonRevisionsResponse(body);
  if (!parsed.ok) return contentError(parsed.message);
  const mapped = (parsed.response as LessonRevisionsResponse).revisions.map(
    (item: LessonRevisionItem) =>
      item.state === 'gone'
        ? {lessonId: item.id, state: 'gone' as const}
        : {
            lessonId: item.id,
            state: 'current' as const,
            contentRevision: item.content_revision,
          },
  );
  return {ok: true, value: mapped};
}

/**
 * Submit one creation request. The caller passes the persisted idempotency
 * key (see `creationIdempotencyStore`): the same key + same body resolves to
 * the same request (INV-006); the same key + different body is 409
 * `IDEMPOTENCY_CONFLICT`.
 */
export async function submitLessonCreation(
  body: LearnerLessonCreationRequestBody,
  idempotencyKey: string,
  options: CanonicalLessonClientOptions = {},
): Promise<CanonicalLessonResult<{requestId: string; status: string}>> {
  const answered = await send(
    LESSON_CREATIONS_PATH,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(body),
    },
    'CREATION_REQUEST_NOT_FOUND',
    options,
  );
  if (!('body' in answered)) return answered;
  const {status, body: responseBody} = answered;
  if (status < 200 || status >= 300) {
    return errorFromStatus(status, responseBody, 'CREATION_REQUEST_NOT_FOUND');
  }
  const parsed = parseLessonCreationAcceptedResponse(responseBody);
  if (!parsed.ok) return contentError(parsed.message);
  return {
    ok: true,
    value: {
      requestId: parsed.response.request.id,
      status: parsed.response.request.status,
    },
  };
}

/** Poll one creation request until it is `succeeded` or `failed`. */
export async function fetchLessonCreationStatus(
  requestId: string,
  options: CanonicalLessonClientOptions = {},
): Promise<CanonicalLessonResult<LessonCreationStatusResponse>> {
  const answered = await send(
    `${LESSON_CREATIONS_PATH}/${encodeURIComponent(requestId)}`,
    {method: 'GET'},
    'CREATION_REQUEST_NOT_FOUND',
    options,
  );
  if (!('body' in answered)) return answered;
  const {status, body} = answered;
  if (status < 200 || status >= 300) {
    return errorFromStatus(status, body, 'CREATION_REQUEST_NOT_FOUND');
  }
  const parsed = parseLessonCreationStatusResponse(body);
  if (!parsed.ok) return contentError(parsed.message);
  return {ok: true, value: parsed.response};
}
