import { authenticatedFetch } from './authenticatedFetch';
import { getAppConfig } from './appConfig';
function withTimeout(timeoutMs: number, externalSignal?: AbortSignal) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        controller.abort();
      });
    }
  }

  return { signal: controller.signal };
}
import type {
  SyncPushRequest,
  SyncPushSuccessResponse,
  SyncPullSuccessResponse,
} from '../schemas/sync';
import {
  SYNC_CONTRACT_VERSION,
  SyncPushSuccessResponseSchema,
  SyncPullSuccessResponseSchema,
} from '../schemas/sync';

export type SyncPushClientResult =
  | { ok: true; data: SyncPushSuccessResponse }
  | { ok: false; errorCode: string; message: string; retryable: boolean };

export type SyncPullClientResult =
  | { ok: true; data: SyncPullSuccessResponse }
  | { ok: false; errorCode: string; message: string; retryable: boolean };

export type SyncClientOptions = {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
};

export async function syncPush(
  request: SyncPushRequest,
  options: SyncClientOptions = {},
): Promise<SyncPushClientResult> {
  const { apiBaseUrl } = getAppConfig();
  const timeout = withTimeout(15000, options.signal);
  try {
    const response = await authenticatedFetch(
      `${apiBaseUrl}/v1/sync/push`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: timeout.signal,
      },
      options.fetchImpl,
    );
    if (!response.ok) {
      return {
        ok: false,
        errorCode: `HTTP_${response.status}`,
        message: `Sync push failed: ${response.status}`,
        retryable: response.status >= 500 || response.status === 429,
      };
    }
    const json = await response.json();
    const parsed = SyncPushSuccessResponseSchema.safeParse(json);
    if (!parsed.success) {
      return {
        ok: false,
        errorCode: 'INVALID_RESPONSE',
        message: parsed.error.message,
        retryable: false,
      };
    }
    const data = parsed.data;
    if (data.contract_version !== SYNC_CONTRACT_VERSION) {
       return {
        ok: false,
        errorCode: 'CONTRACT_MISMATCH',
        message: `Expected contract version ${SYNC_CONTRACT_VERSION}`,
        retryable: false,
      };
    }
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      errorCode: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
      retryable: true,
    };
  }
}

export async function syncPull(
  cursor: string,
  limit: number,
  options: SyncClientOptions = {},
): Promise<SyncPullClientResult> {
  const { apiBaseUrl } = getAppConfig();
  const timeout = withTimeout(15000, options.signal);
  try {
    const query = new URLSearchParams({ cursor, limit: limit.toString() }).toString();
    const response = await authenticatedFetch(
      `${apiBaseUrl}/v1/sync/pull?${query}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: timeout.signal,
      },
      options.fetchImpl,
    );
    if (!response.ok) {
      return {
        ok: false,
        errorCode: `HTTP_${response.status}`,
        message: `Sync pull failed: ${response.status}`,
        retryable: response.status >= 500 || response.status === 429,
      };
    }
    const json = await response.json();
    const parsed = SyncPullSuccessResponseSchema.safeParse(json);
    if (!parsed.success) {
      return {
        ok: false,
        errorCode: 'INVALID_RESPONSE',
        message: parsed.error.message,
        retryable: false,
      };
    }
    const data = parsed.data;
    if (data.contract_version !== SYNC_CONTRACT_VERSION) {
       return {
        ok: false,
        errorCode: 'CONTRACT_MISMATCH',
        message: `Expected contract version ${SYNC_CONTRACT_VERSION}`,
        retryable: false,
      };
    }
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      errorCode: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
      retryable: true,
    };
  }
}
