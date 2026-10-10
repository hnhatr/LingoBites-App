import {create} from 'zustand';

import {getAppConfig} from './appConfig';

/**
 * Last known reachability of the Server (docs/architecture/offline-mode.md).
 *
 * There is no NetInfo dependency: the requests the app already makes are
 * the probe. A transport failure marks the app `offline`, any HTTP response
 * (even an error status) marks it `online`. Screens read the status to show
 * the offline banner and to lock features that need the Server.
 */
export type ConnectivityStatus = 'online' | 'offline';

type ConnectivityState = {status: ConnectivityStatus};

export const useConnectivityStore = create<ConnectivityState>()(() => ({
  status: 'online',
}));

/** A request got an HTTP response. */
export function reportServerReachable(): void {
  if (useConnectivityStore.getState().status !== 'online') {
    useConnectivityStore.setState({status: 'online'});
  }
}

/** A request failed before any HTTP response (no network, DNS, timeout). */
export function reportServerUnreachable(): void {
  if (useConnectivityStore.getState().status !== 'offline') {
    useConnectivityStore.setState({status: 'offline'});
  }
}

export function useIsOffline(): boolean {
  return useConnectivityStore(state => state.status === 'offline');
}

/**
 * Reports one request's outcome: an abort the caller asked for (screen
 * unmounted) says nothing about the network and is ignored.
 */
export async function trackReachability<T>(
  request: Promise<T>,
  callerSignal?: AbortSignal | null,
): Promise<T> {
  try {
    const result = await request;
    reportServerReachable();
    return result;
  } catch (error) {
    if (!callerSignal?.aborted) {
      reportServerUnreachable();
    }
    throw error;
  }
}

export const CONNECTIVITY_PROBE_TIMEOUT_MS = 8_000;

/**
 * Asks the public capabilities route whether the Server is reachable (the
 * "Thử lại" action of a locked feature). Resolves to the new status.
 */
export async function probeConnectivity(
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = CONNECTIVITY_PROBE_TIMEOUT_MS,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const {apiBaseUrl} = getAppConfig();
    await trackReachability(
      fetchImpl(`${apiBaseUrl}/v1/capabilities`, {
        headers: {Accept: 'application/json'},
        signal: controller.signal,
      }),
    );
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Test seam. */
export function resetConnectivityForTests(): void {
  useConnectivityStore.setState({status: 'online'});
}
