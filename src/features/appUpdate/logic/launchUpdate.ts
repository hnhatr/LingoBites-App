import * as Updates from 'expo-updates';

/**
 * Launch-time OTA update (EAS Update). Native CHECK_ON_LAUNCH is NEVER, so
 * this is the only place a release build looks for an update: check once on
 * cold start, download it while the overlay shows progress, then reload into
 * it. Any failure or timeout falls back to the bundle already running.
 */
export type LaunchUpdatePhase =
  | 'checking'
  | 'downloading'
  | 'reloading'
  | 'done';

/** Longest wait for the update server before the app carries on (ms). */
export const LAUNCH_UPDATE_CHECK_TIMEOUT_MS = 5000;
/** Longest the download may block the app before it carries on (ms). */
export const LAUNCH_UPDATE_DOWNLOAD_TIMEOUT_MS = 60000;

export type LaunchUpdateApi = Pick<
  typeof Updates,
  'isEnabled' | 'checkForUpdateAsync' | 'fetchUpdateAsync' | 'reloadAsync'
>;

type LaunchUpdateOptions = {
  api?: LaunchUpdateApi;
  isDev?: boolean;
  checkTimeoutMs?: number;
  downloadTimeoutMs?: number;
};

const TIMED_OUT = Symbol('timed-out');

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMED_OUT>(resolve => {
    timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function runLaunchUpdate(
  onPhase: (phase: LaunchUpdatePhase) => void,
  {
    api = Updates,
    isDev = __DEV__,
    checkTimeoutMs = LAUNCH_UPDATE_CHECK_TIMEOUT_MS,
    downloadTimeoutMs = LAUNCH_UPDATE_DOWNLOAD_TIMEOUT_MS,
  }: LaunchUpdateOptions = {},
): Promise<void> {
  // Debug builds load JS from Metro; expo-updates is disabled there.
  if (isDev || !api.isEnabled) {
    onPhase('done');
    return;
  }
  try {
    onPhase('checking');
    const check = await withTimeout(api.checkForUpdateAsync(), checkTimeoutMs);
    if (check === TIMED_OUT || !check.isAvailable) {
      onPhase('done');
      return;
    }
    onPhase('downloading');
    const fetched = await withTimeout(
      api.fetchUpdateAsync(),
      downloadTimeoutMs,
    );
    if (fetched === TIMED_OUT || !fetched.isNew) {
      onPhase('done');
      return;
    }
    onPhase('reloading');
    await api.reloadAsync();
  } catch {
    onPhase('done');
  }
}
