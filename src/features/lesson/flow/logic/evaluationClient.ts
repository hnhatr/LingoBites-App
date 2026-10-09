import {getAppConfig} from '@core/api/appConfig';
import {authenticatedFetch} from '@core/api/authenticatedFetch';
import {
  EvaluationCapabilitiesResponseSchema,
  type EvaluationPayload,
  EvaluationResponseSchema,
  type EvaluationTarget,
  TextEvaluationResponseSchema,
} from '@core/schemas/evaluation';
import type {LessonSupportLevel} from '@core/schemas/sync';

/**
 * PR 14: the Server's scorer (PR 12–13). Written answers are graded at once;
 * spoken ones are graded after upload and read back by attempt. The written
 * text is sent in the request body only and never logged.
 */

const TIMEOUT_MS = 15_000;

function url(path: string): string {
  return `${getAppConfig().apiBaseUrl.replace(/\/+$/, '')}${path}`;
}

async function request(
  path: string,
  init: RequestInit,
  fetchImpl?: typeof fetch,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await authenticatedFetch(
      url(path),
      {...init, signal: controller.signal},
      fetchImpl,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export type SendTextResult =
  | {ok: true; evaluation: EvaluationPayload}
  /** No network or the Server is down: keep the answer and send it later. */
  | {ok: false; retryable: true}
  /** The Server refused this answer (gone task, wrong mode): do not resend. */
  | {ok: false; retryable: false; code: string};

export async function sendTextEvaluation(
  body: {
    attempt_id: string;
    target: EvaluationTarget;
    text: string;
    support_level: LessonSupportLevel;
    substitute: boolean;
  },
  fetchImpl?: typeof fetch,
): Promise<SendTextResult> {
  let response: Response;
  try {
    response = await request(
      '/v1/evaluations/text',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      fetchImpl,
    );
  } catch {
    return {ok: false, retryable: true};
  }
  if (response.status >= 500 || response.status === 429) {
    return {ok: false, retryable: true};
  }
  const json = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const code =
      (json as {error?: {code?: unknown}} | null)?.error?.code ?? null;
    return {
      ok: false,
      retryable: false,
      code: typeof code === 'string' ? code : `HTTP_${response.status}`,
    };
  }
  const parsed = TextEvaluationResponseSchema.safeParse(json);
  return parsed.success
    ? {ok: true, evaluation: parsed.data.evaluation}
    : {ok: false, retryable: true};
}

export type FetchEvaluationResult =
  | {status: 'ready'; evaluation: EvaluationPayload}
  /** 404: not graded yet (or never will be, see decision H10). */
  | {status: 'not_yet'}
  | {status: 'offline'};

export async function fetchEvaluation(
  attemptId: string,
  fetchImpl?: typeof fetch,
): Promise<FetchEvaluationResult> {
  try {
    const response = await request(
      `/v1/evaluations/${encodeURIComponent(attemptId)}`,
      {method: 'GET', headers: {Accept: 'application/json'}},
      fetchImpl,
    );
    if (response.status === 404) return {status: 'not_yet'};
    if (!response.ok) return {status: 'offline'};
    const parsed = EvaluationResponseSchema.safeParse(await response.json());
    return parsed.success
      ? {status: 'ready', evaluation: parsed.data.evaluation}
      : {status: 'offline'};
  } catch {
    return {status: 'offline'};
  }
}

/** Whether the Server grades this learner's spoken answers; null offline. */
export async function fetchSpeechEvaluationEnabled(
  fetchImpl?: typeof fetch,
): Promise<boolean | null> {
  try {
    const response = await request(
      '/v1/evaluations/capabilities',
      {method: 'GET', headers: {Accept: 'application/json'}},
      fetchImpl,
    );
    if (!response.ok) return null;
    const parsed = EvaluationCapabilitiesResponseSchema.safeParse(
      await response.json(),
    );
    return parsed.success ? parsed.data.evaluation.speech : null;
  } catch {
    return null;
  }
}
