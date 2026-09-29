import {authenticatedFetch} from '@core/api/authenticatedFetch';
import i18n from '@core/i18n';
import type {PracticeEventPayload} from '@core/db/types';
import {PRACTICE_CONTRACT_VERSION} from '@core/schemas/practice';
import {getAppConfig} from '@core/api/appConfig';

/**
 * Wire envelope of one practice outbox row, as POSTed to
 * `POST /v1/practice-events:batch` (P7 §5 / P12).
 * D4: practice-only — no SRS schedule, no `next_review_at`.
 */
export type SyncPracticeEvent = {
  event_id: string;
  event_type: 'practice_answered';
  session_id: string;
  sequence: number;
  occurred_at: string;
  payload: PracticeEventPayload;
};

export type PracticeEventsRejected = {
  event_id: string;
  code: string;
  retryable: boolean;
};

export type PushPracticeEventsResult =
  | {
      ok: true;
      acceptedIds: string[];
      duplicateIds: string[];
      rejected: PracticeEventsRejected[];
    }
  | {
      ok: false;
      errorCode: string;
      message: string;
      retryable: boolean;
    };

type PushPracticeEventsDeps = {
  fetchImpl?: typeof authenticatedFetch;
};

function isSuccessBody(body: unknown): body is {
  accepted_ids: string[];
  duplicate_ids: string[];
  rejected: PracticeEventsRejected[];
} {
  return (
    typeof body === 'object' &&
    body !== null &&
    Array.isArray((body as {accepted_ids?: unknown}).accepted_ids) &&
    Array.isArray((body as {duplicate_ids?: unknown}).duplicate_ids) &&
    Array.isArray((body as {rejected?: unknown}).rejected)
  );
}

function isErrorBody(body: unknown): body is {
  status: 'failed';
  error: {code?: string; message?: string};
} {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as {status?: string}).status === 'failed' &&
    typeof (body as {error?: unknown}).error === 'object'
  );
}

export async function pushPracticeEvents(
  events: SyncPracticeEvent[],
  deps: PushPracticeEventsDeps = {},
): Promise<PushPracticeEventsResult> {
  const {apiBaseUrl} = getAppConfig();
  const fetchImpl = deps.fetchImpl ?? authenticatedFetch;

  let response: Response;
  try {
    response = await fetchImpl(`${apiBaseUrl}/v1/practice-events:batch`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contract_version: PRACTICE_CONTRACT_VERSION,
        events,
      }),
    });
  } catch {
    return {
      ok: false,
      errorCode: 'NETWORK_ERROR',
      message: i18n.t('errors.network_lost'),
      retryable: true,
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {
      ok: false,
      errorCode: 'NETWORK_ERROR',
      message: i18n.t('errors.network_lost'),
      retryable: true,
    };
  }

  if (!response.ok || isErrorBody(body)) {
    const errorBody = isErrorBody(body) ? body : undefined;
    return {
      ok: false,
      errorCode: errorBody?.error.code ?? 'PRACTICE_EVENTS_REJECTED',
      message: errorBody?.error.message?.trim() || i18n.t('errors.sync_failed'),
      retryable: response.status >= 500 || response.status === 429,
    };
  }

  if (!isSuccessBody(body)) {
    return {
      ok: false,
      errorCode: 'PRACTICE_EVENTS_INVALID_RESPONSE',
      message: i18n.t('errors.sync_failed'),
      retryable: true,
    };
  }

  return {
    ok: true,
    acceptedIds: body.accepted_ids,
    duplicateIds: body.duplicate_ids,
    rejected: body.rejected,
  };
}
