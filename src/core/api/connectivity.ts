import {create} from 'zustand';

import {getAppConfig} from './appConfig';
import {createTimeoutSignal} from './timeout';

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

/** A request failed before any HTTP response (no network, DNS, TLS). */
export function reportServerUnreachable(): void {
  if (useConnectivityStore.getState().status !== 'offline') {
    useConnectivityStore.setState({status: 'offline'});
  }
}

/**
 * True only for a request that could not reach the Server: React Native's
 * fetch rejects with `TypeError: Network request failed`, expo/fetch (the
 * global fetch under Expo) with a FetchError whose message starts with
 * "fetch failed:". Anything else (a body the client could not encode, a
 * session or storage error) is a bug on the device, not a lost connection.
 */
export function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (
    error instanceof TypeError &&
    /network request failed/i.test(error.message)
  ) {
    return true;
  }
  return error.message.startsWith('fetch failed:');
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
    if (!callerSignal?.aborted && isNetworkFailure(error)) {
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
  const timeout = createTimeoutSignal(timeoutMs);
  try {
    const {apiBaseUrl} = getAppConfig();
    await trackReachability(
      fetchImpl(`${apiBaseUrl}/v1/capabilities`, {
        headers: {Accept: 'application/json'},
        signal: timeout.signal,
      }),
    );
    return true;
  } catch {
    return false;
  } finally {
    timeout.cleanup();
  }
}

/** Test seam. */
export function resetConnectivityForTests(): void {
  useConnectivityStore.setState({status: 'online'});
}
