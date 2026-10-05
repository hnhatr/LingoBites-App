import {
  countPendingSyncEvents,
  listPendingSyncEvents,
} from './adapters/SyncOutboxRepository';
import {markSyncedNow} from './lastSync';
import {drainOutboxOnce} from './outboxSync';
import {
  isSyncStuck,
  SYNC_MAX_ROUNDS_PER_REQUEST,
  syncRetryDelayMsWithJitter,
} from './syncPolicy';

/**
 * Foreground sync manager for the review outbox.
 *
 * Owns the retry schedule: after a failed drain it re-arms a backoff timer
 * (`syncRetryDelayMsWithJitter`), a new `requestSync()` cancels any pending timer
 * and tries immediately (this is the "network came back" / app-foreground trigger),
 * and rows that hit the attempt cap are left alone instead of retried forever.
 * Everything is best-effort and never throws.
 */
export type SyncManager = {
  start(): void;
  stop(): void;
  requestSync(): void;
  isRunning(): boolean;
};

export type SyncManagerDeps = {
  fetchImpl?: typeof fetch;
  randomFn?: () => number;
};

export function createSyncManager(deps: SyncManagerDeps = {}): SyncManager {
  const randomFn = deps.randomFn ?? Math.random;
  let enabled = false;
  let busy = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let runGeneration = 0;

  function clearRetryTimer(): void {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function scheduleRetry(generation: number): void {
    if (generation !== runGeneration || !enabled) {
      return;
    }
    const pending = listPendingSyncEvents().filter(
      event => !isSyncStuck(event.attemptCount),
    );
    if (pending.length === 0) {
      return;
    }
    const maxAttempt = Math.max(0, ...pending.map(event => event.attemptCount));
    const delayMs = syncRetryDelayMsWithJitter(maxAttempt + 1, randomFn);
    retryTimer = setTimeout(() => {
      if (generation !== runGeneration || !enabled) return;
      retryTimer = null;
      run(false, generation).catch(() => {});
    }, delayMs);
  }

  async function run(includeStuck: boolean, generation: number): Promise<void> {
    if (busy) {
      return;
    }
    busy = true;
    try {
      for (let round = 0; round < SYNC_MAX_ROUNDS_PER_REQUEST; round += 1) {
        if (generation !== runGeneration || !enabled) {
          return;
        }
        const outcome = await drainOutboxOnce({
          fetchImpl: deps.fetchImpl,
          includeStuck,
        });
        if (generation !== runGeneration || !enabled) {
          return;
        }
        if (outcome.status === 'idle' || outcome.status === 'stuck') {
          clearRetryTimer();
          return;
        }
        if (outcome.status === 'failed') {
          if (outcome.retryable) {
            scheduleRetry(generation);
          } else {
            // Permanent rejection (e.g. bad payload): no point auto-retrying.
            // A future foreground/requestSync will still attempt rows again.
            clearRetryTimer();
          }
          return;
        }
        // synced: keep draining while rows remain.
        if (countPendingSyncEvents() === 0) {
          markSyncedNow();
          clearRetryTimer();
          return;
        }
      }
      // More rows than the per-request round cap allows: keep the backoff
      // schedule alive instead of dropping them.
      scheduleRetry(generation);
    } catch {
      scheduleRetry(generation);
    } finally {
      busy = false;
      if (enabled && generation !== runGeneration) {
        requestSync();
      }
    }
  }

  function requestSync(): void {
    if (!enabled || busy) {
      return;
    }
    clearRetryTimer();
    // Explicit triggers may retry capped ("stuck") rows: the cap only governs
    // the automatic backoff timer, so a reconnect still drains a stuck queue.
    run(true, runGeneration).catch(() => {});
  }

  return {
    start() {
      if (enabled) {
        return;
      }
      enabled = true;
      runGeneration += 1;
      requestSync();
    },

    stop() {
      enabled = false;
      runGeneration += 1;
      clearRetryTimer();
    },

    requestSync,

    isRunning() {
      return enabled;
    },
  };
}
