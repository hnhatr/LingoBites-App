import {
  assertSyncDrainOwnershipUnchanged,
  SyncOwnershipChangedError,
} from '@core/sync/syncDrainOwnership';
import {createAuthClient} from '../auth/authClient';
import {ensureValidSession} from '../auth/authSession';

function mergeHeaders(
  initHeaders?: any,
  extra?: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (initHeaders) {
    if (Array.isArray(initHeaders)) {
      initHeaders.forEach(([key, value]) => {
        result[key] = value;
      });
    } else if (typeof (initHeaders as any).forEach === 'function') {
      (initHeaders as any).forEach((value: string, key: string) => {
        result[key] = value;
      });
    } else {
      Object.assign(result, initHeaders);
    }
  }
  if (extra) {
    Object.assign(result, extra);
  }
  return result;
}

export async function authenticatedFetch(
  url: string,
  init?: RequestInit,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const authClient = createAuthClient({fetchImpl});

  let sessionResult = await ensureValidSession({client: authClient});

  if (!(await assertSyncDrainOwnershipUnchanged())) {
    throw new SyncOwnershipChangedError();
  }

  let accessToken =
    sessionResult.status === 'valid'
      ? sessionResult.session.access_token
      : null;

  const headers = mergeHeaders(
    init?.headers,
    accessToken ? {Authorization: `Bearer ${accessToken}`} : undefined,
  );

  let response = await fetchImpl(url, {...init, headers});

  if (response?.status === 401 && sessionResult.status === 'valid') {
    sessionResult = await ensureValidSession({
      client: authClient,
      forceRefresh: true,
    });
    if (!(await assertSyncDrainOwnershipUnchanged())) {
      throw new SyncOwnershipChangedError();
    }
    if (sessionResult.status === 'valid') {
      const retryHeaders = mergeHeaders(init?.headers, {
        Authorization: `Bearer ${sessionResult.session.access_token}`,
      });
      response = await fetchImpl(url, {...init, headers: retryHeaders});
    }
  }

  return response;
}
