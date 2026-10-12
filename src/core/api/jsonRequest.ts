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

export type ApiFailure = {ok: false; kind: ApiFailureKind; message: string};

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
    return {ok: false, kind: 'not-found', message: 'Not found.'};
  }
  if (!response.ok) {
    return {
      ok: false,
      kind: response.status >= 500 ? 'server-error' : 'client-error',
      message: `The request failed (${response.status}).`,
    };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {ok: false, kind: 'contract-mismatch', message: 'Unreadable body.'};
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {ok: false, kind: 'contract-mismatch', message: 'Unexpected body.'};
  }
  return {ok: true, value: parsed.data};
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
