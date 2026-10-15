import type {z} from 'zod';

import {getAppConfig} from './appConfig';
import {authenticatedFetch} from './authenticatedFetch';
import {isNetworkFailure} from './connectivity';

/**
 * A JSON call to the Server with the body checked against a zod schema. A
 * failure comes back as a value (the screens show it), never as a throw. Only
 * the request is sent here: each feature stores what it needs.
 */

export type ApiFailureKind =
  | 'network-error'
  | 'not-found'
  | 'client-error'
  | 'server-error'
  | 'contract-mismatch';

export type ApiFailure = {
  ok: false;
  kind: ApiFailureKind;
  message: string;
  /** The Server's error code (`error.code`), when its body has one. */
  code?: string;
  /** The Server's request id, to find the call in its logs. */
  requestId?: string;
};

export type ApiResult<T> = {ok: true; value: T} | ApiFailure;

export type JsonRequestOptions = {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

export async function requestJson<T>(
  schema: z.ZodType<T>,
  path: string,
  init: RequestInit,
  options: JsonRequestOptions = {},
): Promise<ApiResult<T>> {
  const {apiBaseUrl} = getAppConfig();
  let response: Response;
  try {
    response = await authenticatedFetch(
      `${apiBaseUrl}${path}`,
      {
        ...init,
        headers: {Accept: 'application/json', ...init.headers},
        signal: options.signal,
      },
      options.fetchImpl,
    );
  } catch (error) {
    if (options.signal?.aborted) {
      return {ok: false, kind: 'network-error', message: 'cancelled'};
    }
    return {
      ok: false,
      kind: isNetworkFailure(error) ? 'network-error' : 'server-error',
      message: 'The server could not be reached.',
    };
  }
  if (response.status === 404) {
    return {
      ok: false,
      kind: 'not-found',
      message: 'Not found.',
      ...(await errorDetails(response)),
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      kind: response.status >= 500 ? 'server-error' : 'client-error',
      message: `The request failed (${response.status}).`,
      ...(await errorDetails(response)),
    };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {
      ok: false,
      kind: 'contract-mismatch',
      message: 'Unreadable body.',
      ...headerRequestId(response),
    };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      kind: 'contract-mismatch',
      message: 'Unexpected body.',
      ...headerRequestId(response),
    };
  }
  return {ok: true, value: parsed.data};
}

function headerRequestId(response: Response): Pick<ApiFailure, 'requestId'> {
  const requestId = response.headers?.get?.('X-Request-Id');
  return requestId ? {requestId} : {};
}

/**
 * The error code and request id of a failed call, from the Server's error body
 * (`{request_id, error: {code}}`), else the `X-Request-Id` header. Never throws.
 */
async function errorDetails(
  response: Response,
): Promise<Pick<ApiFailure, 'code' | 'requestId'>> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Not JSON: only the header is left.
  }
  const record =
    body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const error =
    record.error && typeof record.error === 'object'
      ? (record.error as Record<string, unknown>)
      : {};
  const code = typeof error.code === 'string' ? error.code : undefined;
  return {
    ...(code ? {code} : {}),
    ...(typeof record.request_id === 'string'
      ? {requestId: record.request_id}
      : headerRequestId(response)),
  };
}

/** A JSON body for a POST or PUT. */
export function jsonBody(
  body: unknown,
): Pick<RequestInit, 'method' | 'headers' | 'body'> {
  return {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  };
}
