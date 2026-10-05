/**
 * Curriculum-lesson learning progress API client (LING-100 TASK-011 split).
 *
 * Typed, runtime-validated calls for LING-17 lesson and vocabulary progress
 * operations through `authenticatedFetch`, independent of any screen wiring.
 * Mirrors the approved server envelope exactly (snake_case,
 * `request_id`/`status`) per Technical Design comment
 * `01a0d79a-2447-7763-9ab8-335e0cd04f5c` (AD-004/005/007).
 *
 * Boundaries (do not widen without a new task):
 * - No screen hooks, navigation, or local persistence: this module imports
 *   no repository, storage, or database code and never writes responses
 *   anywhere.
 * - No Lesson V2 / curriculum lesson reuse: it never imports from
 *   `lessonV2Client` or `curriculumLesson/*`; those target different
 *   contracts that LING-21 exists to replace.
 * - The submitted attempt `answer` is opaque (`unknown`). Correctness is
 *   never inferred locally; the server validates, evaluates against the
 *   answer key, and returns only `is_correct`. Per-type answer narrowing
 *   aligns with TASK-003 at integration.
 * - No request accepts an authoritative `user_id`; ownership always comes
 *   from the authenticated session. `answer_key` never appears in any
 *   public type: Review exercise projections are strict, so a server leak
 *   fails closed as a protocol error instead of reaching callers.
 */

import {z} from 'zod';

import {getAppConfig} from '@core/api/appConfig';
import {authenticatedFetch} from '@core/api/authenticatedFetch';

export const LEARNING_PROGRESS_CLIENT_FIXTURE_REVISION = 'ling-17-task-005-r1';
export const LEARNING_PROGRESS_CLIENT_DESIGN_REF =
  '01a0d79a-2447-7763-9ab8-335e0cd04f5c';

/* ------------------------------------------------------------------ */
/* Public record types (learner-safe; never carry user_id/answer_key) */
/* ------------------------------------------------------------------ */

export const LessonProgressStatusSchema = z.enum(['in_progress', 'completed']);

export const LessonProgressSchema = z
  .object({
    id: z.string().uuid(),
    lesson_id: z.string().uuid(),
    status: LessonProgressStatusSchema,
    started_at: z.string(),
    completed_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict();

export type LessonProgressStatus = z.infer<typeof LessonProgressStatusSchema>;
export type LessonProgress = z.infer<typeof LessonProgressSchema>;

export const VocabularyProgressStatusSchema = z.enum(['learning', 'known']);

export const VocabularyProgressSchema = z
  .object({
    id: z.string().uuid(),
    vocabulary_id: z.string().uuid(),
    status: VocabularyProgressStatusSchema,
    first_seen_at: z.string(),
    last_seen_at: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict();

export type VocabularyProgressStatus = z.infer<
  typeof VocabularyProgressStatusSchema
>;
export type VocabularyProgress = z.infer<typeof VocabularyProgressSchema>;

export const AttemptResultSchema = z
  .object({
    attempt_id: z.string().uuid(),
    exercise_id: z.string().uuid(),
    is_correct: z.boolean(),
    attempted_at: z.string(),
  })
  .strict();

export type AttemptResult = z.infer<typeof AttemptResultSchema>;

/**
 * Opaque submitted answer. The server validates it against the exercise
 * type and evaluates it; the client never inspects it for correctness.
 */
export type LearningAttemptAnswer = unknown;

/* ------------------------------------------------------------------ */
/* Success envelopes (exact server shapes, snake_case)                 */
/* ------------------------------------------------------------------ */

const LessonProgressEnvelopeSchema = z
  .object({
    request_id: z.string(),
    status: z.literal('success'),
    progress: LessonProgressSchema,
  })
  .strict();

const LessonProgressListEnvelopeSchema = z
  .object({
    request_id: z.string(),
    status: z.literal('success'),
    items: z.array(LessonProgressSchema),
  })
  .strict();

const AttemptEnvelopeSchema = z
  .object({
    request_id: z.string(),
    status: z.literal('success'),
    result: AttemptResultSchema,
  })
  .strict();

const VocabularyProgressEnvelopeSchema = z
  .object({
    request_id: z.string(),
    status: z.literal('success'),
    progress: VocabularyProgressSchema,
  })
  .strict();

/** Loose error envelope: unknown codes must still map, never throw. */
const LearningErrorResponseSchema = z.object({
  request_id: z.string().optional(),
  status: z.literal('failed'),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
  retryable: z.boolean().optional(),
});

/* ------------------------------------------------------------------ */
/* Typed errors                                                        */
/* ------------------------------------------------------------------ */

export type LearningClientErrorKind =
  | 'not-found'
  | 'protocol-error'
  | 'invalid-answer'
  | 'merge-in-progress'
  | 'auth-error'
  | 'server-error'
  | 'network-error';

export type LearningClientError = {
  ok: false;
  kind: LearningClientErrorKind;
  errorCode: string;
  message: string;
  retryable: boolean;
  /** Present and true only when the caller's AbortSignal cancelled the request. */
  cancelled?: boolean;
  /** Raw HTTP status when the server answered. */
  status?: number;
};

export type StartLessonResult =
  | {ok: true; requestId: string; progress: LessonProgress}
  | LearningClientError;

export type CompleteLessonResult = StartLessonResult;

export type LessonProgressListResult =
  | {ok: true; requestId: string; items: LessonProgress[]}
  | LearningClientError;

export type SubmitAttemptResult =
  | {ok: true; requestId: string; result: AttemptResult}
  | LearningClientError;

export type VocabularySeenResult =
  | {ok: true; requestId: string; progress: VocabularyProgress}
  | LearningClientError;

export type SetVocabularyProgressResult = VocabularySeenResult;

export type LearningClientOptions = {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

const NOT_FOUND_CODES = new Set([
  'LESSON_NOT_FOUND',
  'EXERCISE_NOT_FOUND',
  'VOCABULARY_NOT_FOUND',
]);

const PROTOCOL_409_CODES = new Set([
  'LESSON_NOT_STARTED',
  'VOCABULARY_NOT_SEEN',
]);

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function cancelledError(): LearningClientError {
  return {
    ok: false,
    kind: 'network-error',
    errorCode: 'CANCELLED',
    message: 'Request cancelled.',
    retryable: false,
    cancelled: true,
  };
}

function networkError(): LearningClientError {
  return {
    ok: false,
    kind: 'network-error',
    errorCode: 'NETWORK_ERROR',
    message: 'Network connection lost.',
    retryable: true,
  };
}

/** Server answered with success status but the body is not the approved shape. */
function protocolError(message: string): LearningClientError {
  return {
    ok: false,
    kind: 'protocol-error',
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

function errorDetails(body: unknown): {code: string; message: string} | null {
  const parsed = LearningErrorResponseSchema.safeParse(body);
  if (!parsed.success) return null;
  return {code: parsed.data.error.code, message: parsed.data.error.message};
}

/**
 * Map one answered HTTP response to a discriminated error. `notFoundCode`
 * is the endpoint's own 404 code. Every approved error category maps to a
 * distinct `kind`: out-of-order 409s to `protocol-error`, merge 409s to
 * `merge-in-progress`, 422s to `invalid-answer`, 404s to `not-found`,
 * 401/403 to `auth-error`, 5xx/429/503 to retryable `server-error`.
 */
function errorFromResponse(
  status: number,
  body: unknown,
  notFoundCode: string,
): LearningClientError {
  const details = errorDetails(body);
  const code =
    details?.code ?? (status === 404 ? notFoundCode : `HTTP_${status}`);
  const message = details?.message ?? 'Request failed.';
  const base = {errorCode: code, message, status} as const;

  if (status === 401 || status === 403) {
    return {ok: false, kind: 'auth-error', ...base, retryable: false};
  }
  if (code === 'MERGE_IN_PROGRESS') {
    return {ok: false, kind: 'merge-in-progress', ...base, retryable: true};
  }
  if (status === 404 || NOT_FOUND_CODES.has(code)) {
    return {ok: false, kind: 'not-found', ...base, retryable: false};
  }
  if (status === 422 || code === 'EXERCISE_ANSWER_INVALID') {
    return {ok: false, kind: 'invalid-answer', ...base, retryable: false};
  }
  if (status === 400 || PROTOCOL_409_CODES.has(code)) {
    return {ok: false, kind: 'protocol-error', ...base, retryable: false};
  }
  if (status >= 500 || status === 429 || status === 503) {
    return {ok: false, kind: 'server-error', ...base, retryable: true};
  }
  return {ok: false, kind: 'server-error', ...base, retryable: false};
}

type AnsweredResponse = {status: number; body: unknown};

async function send(
  path: string,
  init: Omit<RequestInit, 'signal'>,
  notFoundCode: string,
  options: LearningClientOptions,
): Promise<AnsweredResponse | LearningClientError> {
  if (options.signal?.aborted) return cancelledError();
  const {apiBaseUrl} = getAppConfig();
  let response: Response;
  try {
    response = await authenticatedFetch(
      `${apiBaseUrl}${path}`,
      {...init, signal: options.signal},
      options.fetchImpl,
    );
  } catch (error) {
    return isAbortError(error) || options.signal?.aborted
      ? cancelledError()
      : networkError();
  }
  const body = await readJson(response);
  if (!response.ok) {
    return errorFromResponse(response.status, body, notFoundCode);
  }
  return {status: response.status, body};
}

/* ------------------------------------------------------------------ */
/* Eight LING-17 operations                                            */
/* ------------------------------------------------------------------ */

/**
 * Start a lesson. Idempotent: replaying returns the unchanged row
 * (a completed lesson is never reset).
 * `POST /v1/lessons/:id/start`, no body.
 */
export async function startLessonProgress(
  lessonId: string,
  options: LearningClientOptions = {},
): Promise<StartLessonResult> {
  const answered = await send(
    `/v1/lessons/${encodeURIComponent(lessonId)}/start`,
    {method: 'POST', headers: {Accept: 'application/json'}},
    'LESSON_NOT_FOUND',
    options,
  );
  if (!('body' in answered)) return answered;
  const parsed = LessonProgressEnvelopeSchema.safeParse(answered.body);
  if (!parsed.success) {
    return protocolError('Server returned an invalid lesson progress.');
  }
  return {
    ok: true,
    requestId: parsed.data.request_id,
    progress: parsed.data.progress,
  };
}

/**
 * Complete a started lesson. Idempotent: a completed row is returned
 * unchanged; completing before start answers 409 `LESSON_NOT_STARTED`.
 * `POST /v1/lessons/:id/complete`, no body.
 */
export async function completeLessonProgress(
  lessonId: string,
  options: LearningClientOptions = {},
): Promise<CompleteLessonResult> {
  const answered = await send(
    `/v1/lessons/${encodeURIComponent(lessonId)}/complete`,
    {method: 'POST', headers: {Accept: 'application/json'}},
    'LESSON_NOT_FOUND',
    options,
  );
  if (!('body' in answered)) return answered;
  const parsed = LessonProgressEnvelopeSchema.safeParse(answered.body);
  if (!parsed.success) {
    return protocolError('Server returned an invalid lesson progress.');
  }
  return {
    ok: true,
    requestId: parsed.data.request_id,
    progress: parsed.data.progress,
  };
}

/**
 * List all materialized lesson progress for the owner, newest first.
 * Missing rows stay implicit (not started).
 * `GET /v1/me/lesson-progress`.
 */
export async function listLessonProgress(
  options: LearningClientOptions = {},
): Promise<LessonProgressListResult> {
  const answered = await send(
    '/v1/me/lesson-progress',
    {method: 'GET', headers: {Accept: 'application/json'}},
    'LESSON_NOT_FOUND',
    options,
  );
  if (!('body' in answered)) return answered;
  const parsed = LessonProgressListEnvelopeSchema.safeParse(answered.body);
  if (!parsed.success) {
    return protocolError('Server returned an invalid lesson progress list.');
  }
  return {
    ok: true,
    requestId: parsed.data.request_id,
    items: parsed.data.items,
  };
}

/**
 * Submit one answer and append one attempt. Intentionally non-idempotent:
 * every valid call records a new attempt. The answer is opaque here;
 * only the server's `is_correct` is ever trusted.
 * `POST /v1/exercises/:id/attempts` with body `{ answer }`.
 */
export async function submitExerciseAttempt(
  exerciseId: string,
  answer: LearningAttemptAnswer,
  options: LearningClientOptions = {},
): Promise<SubmitAttemptResult> {
  const answered = await send(
    `/v1/exercises/${encodeURIComponent(exerciseId)}/attempts`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({answer}),
    },
    'EXERCISE_NOT_FOUND',
    options,
  );
  if (!('body' in answered)) return answered;
  const parsed = AttemptEnvelopeSchema.safeParse(answered.body);
  if (!parsed.success) {
    return protocolError('Server returned an invalid attempt result.');
  }
  return {
    ok: true,
    requestId: parsed.data.request_id,
    result: parsed.data.result,
  };
}

/**
 * Mark a vocabulary item seen. Conflict-safe: repeats advance
 * `last_seen_at` but never `first_seen_at` or status.
 * `POST /v1/vocabularies/:id/seen`, no body.
 */
export async function markVocabularySeen(
  vocabularyId: string,
  options: LearningClientOptions = {},
): Promise<VocabularySeenResult> {
  const answered = await send(
    `/v1/vocabularies/${encodeURIComponent(vocabularyId)}/seen`,
    {method: 'POST', headers: {Accept: 'application/json'}},
    'VOCABULARY_NOT_FOUND',
    options,
  );
  if (!('body' in answered)) return answered;
  const parsed = VocabularyProgressEnvelopeSchema.safeParse(answered.body);
  if (!parsed.success) {
    return protocolError('Server returned an invalid vocabulary progress.');
  }
  return {
    ok: true,
    requestId: parsed.data.request_id,
    progress: parsed.data.progress,
  };
}

/**
 * Explicitly set vocabulary status in either direction (`known` back to
 * `learning` is allowed). Setting the current value is a server no-op.
 * `PUT /v1/vocabularies/:id/progress` with body `{ status }`.
 */
export async function setVocabularyProgress(
  vocabularyId: string,
  status: VocabularyProgressStatus,
  options: LearningClientOptions = {},
): Promise<SetVocabularyProgressResult> {
  if (status !== 'learning' && status !== 'known') {
    return {
      ok: false,
      kind: 'protocol-error',
      errorCode: 'VALIDATION_VOCABULARY_STATUS',
      message: 'Status must be learning or known.',
      retryable: false,
    };
  }
  const answered = await send(
    `/v1/vocabularies/${encodeURIComponent(vocabularyId)}/progress`,
    {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({status}),
    },
    'VOCABULARY_NOT_FOUND',
    options,
  );
  if (!('body' in answered)) return answered;
  const parsed = VocabularyProgressEnvelopeSchema.safeParse(answered.body);
  if (!parsed.success) {
    return protocolError('Server returned an invalid vocabulary progress.');
  }
  return {
    ok: true,
    requestId: parsed.data.request_id,
    progress: parsed.data.progress,
  };
}
