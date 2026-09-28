/**
 * Learning review API client (LING-100 TASK-011 split).
 *
 * Owns `GET /v1/me/review` and learner-safe Review projections.
 */

import {z} from 'zod';
import {authenticatedFetch} from '@shared/api/authenticatedFetch';
import {getAppConfig} from '@shared/api/appConfig';
import type {
  LearningClientError,
  LearningClientOptions,
} from '@modules/curriculumLesson';

export const LEARNING_REVIEW_CLIENT_FIXTURE_REVISION = 'ling-17-task-005-r1';
export const LEARNING_REVIEW_CLIENT_DESIGN_REF =
  '01a0d79a-2447-7763-9ab8-335e0cd04f5c';

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
 * Learner-safe exercise projection inside Review. Strict on purpose: the
 * server must never return `answer_key` (or `explanation`) here, so any
 * such leak fails closed as a protocol error instead of reaching callers.
 */
export const ReviewExerciseContentSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    type: z.string(),
    instruction: z.string().nullable(),
    prompt: z.string(),
    config: z.unknown(),
  })
  .strict();

export type ReviewExerciseContent = z.infer<typeof ReviewExerciseContentSchema>;

export const ReviewExerciseEntrySchema = z
  .object({
    exercise: ReviewExerciseContentSchema,
    latest_attempt: AttemptResultSchema,
  })
  .strict();

export type ReviewExerciseEntry = z.infer<typeof ReviewExerciseEntrySchema>;

/** Learner-safe vocabulary projection inside Review. */
export const ReviewVocabularyContentSchema = z
  .object({
    id: z.string().uuid(),
    key: z.string(),
    language: z.string(),
    lemma: z.string(),
    part_of_speech: z.string().nullable(),
    meaning: z.string(),
    ipa: z.string().nullable(),
    audio_media_id: z.string().uuid().nullable(),
    image_media_id: z.string().uuid().nullable(),
  })
  .strict();

export type ReviewVocabularyContent = z.infer<
  typeof ReviewVocabularyContentSchema
>;

export const ReviewVocabularyEntrySchema = z
  .object({
    vocabulary: ReviewVocabularyContentSchema,
    progress: VocabularyProgressSchema,
  })
  .strict();

export type ReviewVocabularyEntry = z.infer<typeof ReviewVocabularyEntrySchema>;

const ReviewEnvelopeSchema = z
  .object({
    request_id: z.string(),
    status: z.literal('success'),
    exercises: z.array(ReviewExerciseEntrySchema),
    vocabularies: z.array(ReviewVocabularyEntrySchema),
  })
  .strict();

export type ReviewResult =
  | {
      ok: true;
      requestId: string;
      exercises: ReviewExerciseEntry[];
      vocabularies: ReviewVocabularyEntry[];
    }
  | LearningClientError;

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

/**
 * Derived Review: latest-incorrect exercises plus `learning` vocabulary.
 * `GET /v1/me/review`.
 */
export async function fetchReview(
  options: LearningClientOptions = {},
): Promise<ReviewResult> {
  const answered = await send(
    '/v1/me/review',
    {method: 'GET', headers: {Accept: 'application/json'}},
    'EXERCISE_NOT_FOUND',
    options,
  );
  if (!('body' in answered)) return answered;
  const parsed = ReviewEnvelopeSchema.safeParse(answered.body);
  if (!parsed.success) {
    return protocolError('Server returned an invalid review.');
  }
  return {
    ok: true,
    requestId: parsed.data.request_id,
    exercises: parsed.data.exercises,
    vocabularies: parsed.data.vocabularies,
  };
}
