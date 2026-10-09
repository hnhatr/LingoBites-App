/**
 * S4.3 "Học theo 6 bước" API client. Learner routes:
 * `POST /api/v1/lessons/:id/compose`, `GET /api/v1/lessons/compose-quota`,
 * `GET /api/v1/lesson-creations?kind=compose&active=true`; the request is
 * polled with `fetchLessonCreationStatus` like any other creation.
 *
 * Same conventions as `canonicalLessonClient.ts` (authenticated fetch, strict
 * zod parse, no local persistence).
 */
import {z} from 'zod';

import {getAppConfig} from '@core/api/appConfig';
import {
  type ActiveCompose,
  ActiveComposeResponseSchema,
  ComposeCachedResponseSchema,
  type ComposeQuota,
  ComposeQuotaResponseSchema,
  LessonCreationAcceptedResponseSchema,
} from '@core/schemas/lesson';

import {
  type CanonicalLessonClientOptions,
  type CanonicalLessonError,
  type CanonicalLessonResult,
  contentError,
  errorFromStatus,
  send,
} from './canonicalLessonClient';

const LESSONS_PATH = '/api/v1/lessons';
const LESSON_CREATIONS_PATH = '/api/v1/lesson-creations';

/** Same bounds as the Server (S4.1 H1). */
export const COMPOSE_PICK_MIN = 2;
export const COMPOSE_PICK_MAX = 8;

export type ComposeSubmitValue =
  | {kind: 'cached'; lessonId: string}
  | {kind: 'queued'; requestId: string};

/**
 * A refusal the Server answered before any AI ran (never charged), with the
 * `details` it sent, e.g. `{limit, used, resets_at}` for the daily limit.
 */
export type ComposeSubmitError = CanonicalLessonError & {
  details?: Record<string, unknown>;
};

function detailsOf(body: unknown): Record<string, unknown> | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const details = (body as {details?: unknown}).details;
  return typeof details === 'object' && details !== null
    ? (details as Record<string, unknown>)
    : undefined;
}

/**
 * Ask for a six-step lesson from the picked sentences. The caller keeps one
 * idempotency key per pick, so a retry after a network error never queues a
 * second request (INV-006).
 */
export async function submitCompose(
  lessonId: string,
  sentenceIds: readonly string[],
  idempotencyKey: string,
  options: CanonicalLessonClientOptions = {},
): Promise<{ok: true; value: ComposeSubmitValue} | ComposeSubmitError> {
  const answered = await send(
    `${LESSONS_PATH}/${encodeURIComponent(lessonId)}/compose`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({sentence_ids: sentenceIds}),
    },
    'LESSON_NOT_FOUND',
    options,
  );
  if (!('body' in answered)) return answered;
  const {status, body} = answered;
  if (status === 200) {
    const parsed = ComposeCachedResponseSchema.safeParse(body);
    return parsed.success
      ? {ok: true, value: {kind: 'cached', lessonId: parsed.data.lesson_id}}
      : contentError('Compose response failed validation.');
  }
  if (status === 202) {
    const parsed = LessonCreationAcceptedResponseSchema.safeParse(body);
    return parsed.success
      ? {ok: true, value: {kind: 'queued', requestId: parsed.data.request.id}}
      : contentError('Compose response failed validation.');
  }
  const details = detailsOf(body);
  return {
    ...errorFromStatus(status, body, 'LESSON_NOT_FOUND'),
    ...(details ? {details} : {}),
  };
}

/** Today's composes of the caller: limit, used, remaining, reset time. */
export async function fetchComposeQuota(
  options: CanonicalLessonClientOptions = {},
): Promise<CanonicalLessonResult<ComposeQuota>> {
  const answered = await send(
    `${LESSONS_PATH}/compose-quota`,
    {method: 'GET'},
    'LESSON_NOT_FOUND',
    options,
  );
  if (!('body' in answered)) return answered;
  const {status, body} = answered;
  if (status < 200 || status >= 300) {
    return errorFromStatus(status, body, 'LESSON_NOT_FOUND');
  }
  const parsed = ComposeQuotaResponseSchema.safeParse(body);
  if (!parsed.success) return contentError('Quota response failed validation.');
  return {ok: true, value: parsed.data.quota};
}

/** The caller's composes still queued or running (another device included). */
export async function fetchActiveComposes(
  options: CanonicalLessonClientOptions = {},
): Promise<CanonicalLessonResult<ActiveCompose[]>> {
  const answered = await send(
    `${LESSON_CREATIONS_PATH}?kind=compose&active=true`,
    {method: 'GET'},
    'CREATION_REQUEST_NOT_FOUND',
    options,
  );
  if (!('body' in answered)) return answered;
  const {status, body} = answered;
  if (status < 200 || status >= 300) {
    return errorFromStatus(status, body, 'CREATION_REQUEST_NOT_FOUND');
  }
  const parsed = ActiveComposeResponseSchema.safeParse(body);
  if (!parsed.success) {
    return contentError('Active compose response failed validation.');
  }
  return {ok: true, value: parsed.data.requests};
}

const ComposeCapabilitySchema = z.object({
  capabilities: z.object({
    lessons: z.object({
      compose: z.object({enabled: z.boolean()}),
    }),
  }),
});

/**
 * `lessons.compose.enabled` from the public capability probe. Fail-closed:
 * an older Server without the key, a network or parse problem all read as
 * `false`, so the entry stays hidden.
 */
export async function fetchComposeCapability(
  options: {fetchImpl?: typeof fetch; signal?: AbortSignal} = {},
): Promise<boolean> {
  try {
    const {apiBaseUrl} = getAppConfig();
    const response = await (options.fetchImpl ?? fetch)(
      `${apiBaseUrl}/v1/capabilities`,
      {headers: {Accept: 'application/json'}, signal: options.signal},
    );
    if (!response.ok) return false;
    const parsed = ComposeCapabilitySchema.safeParse(await response.json());
    return parsed.success
      ? parsed.data.capabilities.lessons.compose.enabled
      : false;
  } catch {
    return false;
  }
}
