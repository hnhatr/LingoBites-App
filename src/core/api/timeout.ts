/**
 * Shared request timeouts. Every HTTP client that gives up after a fixed time
 * builds its abort signal here, so the timer is always cleared and the
 * caller's abort listener is always removed when the request settles.
 */

export type TimeoutSignal = {
  /** Aborts when the timer fires or when the caller's signal aborts. */
  signal: AbortSignal;
  /** True once the timer, not the caller, aborted the signal. */
  timedOut: () => boolean;
  /** Clears the timer and detaches from the caller's signal. Idempotent. */
  cleanup: () => void;
};

export function createTimeoutSignal(
  timeoutMs: number,
  callerSignal?: AbortSignal | null,
): TimeoutSignal {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onCallerAbort = () => controller.abort();

  const cleanup = () => {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  };

  if (callerSignal?.aborted) {
    controller.abort();
    cleanup();
  } else {
    callerSignal?.addEventListener('abort', onCallerAbort, {once: true});
  }

  return {signal: controller.signal, timedOut: () => timedOut, cleanup};
}

export const TIMED_OUT = Symbol('timed-out');

/**
 * Resolves to `TIMED_OUT` when `promise` has not settled after `timeoutMs`.
 * For work that cannot be aborted (the promise keeps running in the
 * background); use `createTimeoutSignal` for fetches.
 */
export function raceWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMED_OUT>(resolve => {
    timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
