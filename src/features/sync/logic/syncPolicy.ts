/**
 * Drain/retry policy for the review outbox (SETE-87).
 *
 * Pure, deterministic helpers so the exponential backoff and the attempt cap
 * are unit-testable without timers or the network.
 */

/** Max events sent in one drain request. */
export const SYNC_BATCH_LIMIT = 100;

/** Attempt cap before a row is considered stuck (no infinite retry storm). */
export const MAX_SYNC_ATTEMPTS = 8;

export const SYNC_RETRY_BASE_MS = 5_000;
export const SYNC_RETRY_MAX_MS = 5 * 60_000;

/** Number of drain rounds a single `requestSync()` may run while rows remain. */
export const SYNC_MAX_ROUNDS_PER_REQUEST = 5;

/**
 * Exponential backoff before the next attempt, by the number of attempts
 * already made. Attempt 1 waits base, attempt 2 waits 2x base, etc, capped at
 * `SYNC_RETRY_MAX_MS`.
 */
export function syncRetryDelayMs(attemptCount: number): number {
  const exponent = Math.max(0, attemptCount - 1);
  const raw = SYNC_RETRY_BASE_MS * 2 ** exponent;
  return Math.min(raw, SYNC_RETRY_MAX_MS);
}

/** A row that reached the cap is stuck and must not be auto-retried. */
export function isSyncStuck(attemptCount: number): boolean {
  return attemptCount >= MAX_SYNC_ATTEMPTS;
}

/**
 * Exponential backoff with equal jitter (P12 at-least-once).
 * `syncRetryDelayMs` stays deterministic for existing callers/tests;
 * this spreads thundering-herd retries over [delay/2, delay].
 * `randomFn` is injectable for deterministic tests.
 */
export function syncRetryDelayMsWithJitter(
  attemptCount: number,
  randomFn: () => number = Math.random,
): number {
  const base = syncRetryDelayMs(attemptCount);
  const jitter = randomFn();
  return Math.floor(base / 2 + (base / 2) * jitter);
}
