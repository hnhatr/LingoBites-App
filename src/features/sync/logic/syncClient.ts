import {getAppConfig} from '@core/api/appConfig';
import {authenticatedFetch} from '@core/api/authenticatedFetch';
import type {
  SyncPullSuccessResponse,
  SyncPushRequest,
  SyncPushSuccessResponse,
} from '@core/schemas/sync';
import {
  SYNC_CONTRACT_VERSION,
  SyncPullSuccessResponseSchema,
  SyncPushSuccessResponseSchema,
} from '@core/schemas/sync';
import {
  SYNC_OWNERSHIP_CHANGED,
  SyncOwnershipChangedError,
} from '@core/sync/syncDrainOwnership';

function withTimeout(timeoutMs: number, externalSignal?: AbortSignal) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const cleanup = () => clearTimeout(timeoutId);

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
      cleanup();
    } else {
      externalSignal.addEventListener('abort', () => {
        cleanup();
        controller.abort();
      });
    }
  }

  return {signal: controller.signal, cleanup};
}

export type SyncPushClientResult =
  | {ok: true; data: SyncPushSuccessResponse}
  | {ok: false; errorCode: string; message: string; retryable: boolean};

export type SyncPullClientResult =
  | {ok: true; data: SyncPullSuccessResponse}
  | {ok: false; errorCode: string; message: string; retryable: boolean};

export type SyncClientOptions = {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
};

export async function syncPush(
  request: SyncPushRequest,
  options: SyncClientOptions = {},
): Promise<SyncPushClientResult> {
  const {apiBaseUrl} = getAppConfig();
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
    return {ok: true, data};
  } catch (error) {
    if (error instanceof SyncOwnershipChangedError) {
      return {
        ok: false,
        errorCode: SYNC_OWNERSHIP_CHANGED,
        message: 'Sync paused because the active account changed.',
        retryable: true,
      };
    }
    return {
      ok: false,
      errorCode: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
      retryable: true,
    };
  } finally {
    timeout.cleanup();
  }
}

export async function syncPull(
  cursor: string,
  limit: number,
  options: SyncClientOptions = {},
): Promise<SyncPullClientResult> {
  const {apiBaseUrl} = getAppConfig();
  const timeout = withTimeout(15000, options.signal);
  try {
    const query = new URLSearchParams({
      cursor,
      limit: limit.toString(),
    }).toString();
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
    return {ok: true, data};
  } catch (error) {
    return {
      ok: false,
      errorCode: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
      retryable: true,
    };
  } finally {
    timeout.cleanup();
  }
}
