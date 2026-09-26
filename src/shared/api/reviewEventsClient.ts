import {authenticatedFetch} from './authenticatedFetch';
import i18n from '@/i18n';
import type {ReviewEventPayload} from '../db/types';
import {getAppConfig} from './appConfig';

/**
 * Wire envelope of one drained outbox row, as POSTed to the server. Mirrors the
 * `sync_outbox` columns; the payload is the versioned review event body.
 */
export type SyncReviewEvent = {
  id: string;
  event_type: 'review';
  entity_id: string;
  payload: ReviewEventPayload;
  created_at: string;
};

export type PushReviewEventsResult =
  | {ok: true; acceptedIds: string[]; duplicateIds: string[]}
  | {
      ok: false;
      errorCode: string;
      message: string;
      retryable: boolean;
    };

type PushReviewEventsDeps = {
  fetchImpl?: typeof authenticatedFetch;
};

function isSuccessBody(body: unknown): body is {
  status: 'success';
  accepted_ids: string[];
  duplicate_ids: string[];
} {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as {status?: string}).status === 'success' &&
    Array.isArray((body as {accepted_ids?: unknown}).accepted_ids) &&
    Array.isArray((body as {duplicate_ids?: unknown}).duplicate_ids)
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

export async function pushReviewEvents(
  events: SyncReviewEvent[],
  deps: PushReviewEventsDeps = {},
): Promise<PushReviewEventsResult> {
  const {apiBaseUrl} = getAppConfig();
  const fetchImpl = deps.fetchImpl ?? authenticatedFetch;

  let response: Response;
  try {
    response = await fetchImpl(`${apiBaseUrl}/v1/review-events`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({events}),
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
      errorCode: errorBody?.error.code ?? 'REVIEW_EVENTS_REJECTED',
      message: errorBody?.error.message?.trim() || i18n.t('errors.sync_failed'),
      retryable: response.status >= 500 || response.status === 429,
    };
  }

  if (!isSuccessBody(body)) {
    return {
      ok: false,
      errorCode: 'REVIEW_EVENTS_INVALID_RESPONSE',
      message: i18n.t('errors.sync_failed'),
      retryable: true,
    };
  }

  return {
    ok: true,
    acceptedIds: body.accepted_ids,
    duplicateIds: body.duplicate_ids,
  };
}
