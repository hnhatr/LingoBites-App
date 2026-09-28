/**
 * CurriculumLesson API client: lesson aggregate + exercise check.
 *
 * Follows the per-domain convention in `src/shared/api/*Client.ts`
 * (`authenticatedFetch`, `getAppConfig`, injected `fetchImpl`,
 * `AbortSignal`) but lives under `src/modules/curriculumLesson` so the
 * shared layer never depends on a feature module. Exact learner routes:
 * `GET /api/v1/lessons/:id` and `POST /api/v1/exercises/:id/check`.
 *
 * No local persistence of any kind: this module imports no repository,
 * storage, or database code, and never writes responses anywhere.
 */
import {authenticatedFetch} from '@shared/api/authenticatedFetch';
import {getAppConfig} from '@shared/api/appConfig';
import {
  CurriculumLessonErrorResponseSchema,
  parseCurriculumLessonAggregateResponse,
  parseCurriculumLessonCheckResponse,
  type CurriculumLesson,
  type CurriculumLessonExerciseExplanation,
} from './curriculumLessonSchema';

const LESSON_AGGREGATE_PATH = '/api/v1/lessons';
const EXERCISE_CHECK_PATH = '/api/v1/exercises';

export type CurriculumLessonErrorKind =
  | 'not-found'
  | 'content-error'
  | 'network-error'
  | 'auth-error'
  | 'server-error'
  | 'invalid-answer';

export type CurriculumLessonError = {
  ok: false;
  kind: CurriculumLessonErrorKind;
  errorCode: string;
  message: string;
  retryable: boolean;
  /** Present and true only when the caller's AbortSignal cancelled the request. */
  cancelled?: boolean;
  /** Raw HTTP status when the server answered. */
  status?: number;
};

export type CurriculumLessonResult =
  | {ok: true; requestId: string; lesson: CurriculumLesson}
  | CurriculumLessonError;

export type CurriculumLessonCheckResult =
  | {
      ok: true;
      requestId: string;
      correct: boolean;
      explanation: CurriculumLessonExerciseExplanation;
    }
  | CurriculumLessonError;

export type CurriculumLessonClientOptions = {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function cancelledError(): CurriculumLessonError {
  return {
    ok: false,
    kind: 'network-error',
    errorCode: 'CANCELLED',
    message: 'Request cancelled.',
    retryable: false,
    cancelled: true,
  };
}

function networkError(): CurriculumLessonError {
  return {
    ok: false,
    kind: 'network-error',
    errorCode: 'NETWORK_ERROR',
    message: 'Network connection lost.',
    retryable: true,
  };
}

function contentError(message: string): CurriculumLessonError {
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

function errorDetails(body: unknown): {code: string; message: string} | null {
  const parsed = CurriculumLessonErrorResponseSchema.safeParse(body);
  if (!parsed.success) return null;
  return {code: parsed.data.error.code, message: parsed.data.error.message};
}

/**
 * Map one answered HTTP response to a discriminated error. `notFoundCode`
 * is the endpoint's own 404 code (`LESSON_NOT_FOUND` / `EXERCISE_NOT_FOUND`).
 */
function errorFromResponse(
  status: number,
  body: unknown,
  notFoundCode: string,
): CurriculumLessonError {
  const details = errorDetails(body);
  const code =
    details?.code ?? (status === 404 ? notFoundCode : `HTTP_${status}`);
  const message = details?.message ?? 'Request failed.';
  const base = {errorCode: code, message, status} as const;

  if (status === 401 || status === 403) {
    return {ok: false, kind: 'auth-error', ...base, retryable: false};
  }
  if (
    status === 404 ||
    code === 'LESSON_NOT_FOUND' ||
    code === 'EXERCISE_NOT_FOUND'
  ) {
    return {ok: false, kind: 'not-found', ...base, retryable: false};
  }
  if (code === 'LESSON_CONTENT_INVALID') {
    return {ok: false, kind: 'content-error', ...base, retryable: false};
  }
  if (code === 'INVALID_EXERCISE_ANSWER') {
    return {ok: false, kind: 'invalid-answer', ...base, retryable: false};
  }
  if (status >= 500 || status === 429) {
    return {ok: false, kind: 'server-error', ...base, retryable: true};
  }
  return {ok: false, kind: 'server-error', ...base, retryable: false};
}

async function getJson(
  path: string,
  notFoundCode: string,
  options: CurriculumLessonClientOptions,
): Promise<{status: number; body: unknown} | CurriculumLessonError> {
  if (options.signal?.aborted) return cancelledError();
  const {apiBaseUrl} = getAppConfig();
  let response: Response;
  try {
    response = await authenticatedFetch(
      `${apiBaseUrl}${path}`,
      {
        method: 'GET',
        headers: {Accept: 'application/json'},
        signal: options.signal,
      },
      options.fetchImpl,
    );
  } catch (error) {
    return isAbortError(error) || options.signal?.aborted
      ? cancelledError()
      : networkError();
  }
  return {status: response.status, body: await readJson(response)};
}

/**
 * Load one published lesson aggregate. Draft/archived lessons answer 404
 * (`not-found`); lessons with broken required resources answer
 * `LESSON_CONTENT_INVALID` (`content-error`).
 */
export async function fetchCurriculumLesson(
  lessonId: string,
  options: CurriculumLessonClientOptions = {},
): Promise<CurriculumLessonResult> {
  const answered = await getJson(
    `${LESSON_AGGREGATE_PATH}/${encodeURIComponent(lessonId)}`,
    'LESSON_NOT_FOUND',
    options,
  );
  if (!('body' in answered)) return answered;
  const {status, body} = answered;
  if (status < 200 || status >= 300) {
    return errorFromResponse(status, body, 'LESSON_NOT_FOUND');
  }
  const parsed = parseCurriculumLessonAggregateResponse(body);
  if (!parsed.ok) return contentError(parsed.message);
  return {ok: true, requestId: parsed.requestId, lesson: parsed.lesson};
}

/**
 * Discriminated answer input. `{optionId}` targets multiple-choice
 * exercises; `{text}` targets fill-blank/translation exercises.
 * Correctness is always evaluated server-side.
 */
export type CurriculumLessonAnswerInput = {optionId: string} | {text: string};

function invalidAnswer(message: string): CurriculumLessonError {
  return {
    ok: false,
    kind: 'invalid-answer',
    errorCode: 'INVALID_EXERCISE_ANSWER',
    message,
    retryable: false,
  };
}

function toAnswerBody(
  answer: CurriculumLessonAnswerInput,
): {optionId: string} | {text: string} | null {
  if (typeof answer !== 'object' || answer === null) return null;
  if ('optionId' in answer) {
    return typeof answer.optionId === 'string' &&
      answer.optionId.trim().length > 0
      ? {optionId: answer.optionId}
      : null;
  }
  if ('text' in answer) {
    return typeof answer.text === 'string' && answer.text.trim().length > 0
      ? {text: answer.text}
      : null;
  }
  return null;
}

/**
 * Check one exercise answer server-side. The answer key never
 * leaves the Server; nothing is persisted on either side.
 */
export async function checkCurriculumLessonExercise(
  exerciseId: string,
  answer: CurriculumLessonAnswerInput,
  options: CurriculumLessonClientOptions = {},
): Promise<CurriculumLessonCheckResult> {
  const answerBody = toAnswerBody(answer);
  if (!answerBody) {
    return invalidAnswer('Answer must include an option or text.');
  }
  if (options.signal?.aborted) return cancelledError();
  const {apiBaseUrl} = getAppConfig();
  let response: Response;
  try {
    response = await authenticatedFetch(
      `${apiBaseUrl}${EXERCISE_CHECK_PATH}/${encodeURIComponent(
        exerciseId,
      )}/check`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({answer: answerBody}),
        signal: options.signal,
      },
      options.fetchImpl,
    );
  } catch (error) {
    return isAbortError(error) || options.signal?.aborted
      ? cancelledError()
      : networkError();
  }
  const {status} = response;
  const body = await readJson(response);
  if (status < 200 || status >= 300) {
    return errorFromResponse(status, body, 'EXERCISE_NOT_FOUND');
  }
  const parsed = parseCurriculumLessonCheckResponse(body);
  if (!parsed.ok) return contentError(parsed.message);
  return {
    ok: true,
    requestId: parsed.requestId,
    correct: parsed.correct,
    explanation: parsed.explanation,
  };
}
