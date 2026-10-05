import {AppState, type AppStateStatus} from 'react-native';

import {readLastSyncedAt} from './lastSync';
import {runPullWorker, startPullWorker, stopPullWorker} from './pullWorker';
import {createSyncManager, type SyncManager} from './syncManager';

/**
 * App-lifecycle wiring for the outbox sync manager (SETE-87).
 *
 * The manager drains on start and on every foreground/background transition;
 * when the network is down the failed attempts re-arm an in-process backoff
 * retry, so toggling connectivity back on while the app stays open syncs the
 * pending queue without a NetInfo dependency (the fetch itself is the probe).
 */
let manager: SyncManager | null = null;
let subscription: {remove: () => void} | null = null;

function ensureManager(): SyncManager {
  if (!manager) {
    manager = createSyncManager();
  }
  return manager;
}

function onAppStateChange(nextState: AppStateStatus): void {
  if (nextState === 'active' || nextState === 'background') {
    ensureManager().requestSync();
  }
}

/**
 * Best-effort kick used after a review write commits an outbox row. No-ops
 * until `startAppSync()` has run, so unit tests that never start the manager
 * are not affected by network side effects.
 */
export function requestSync(): void {
  if (manager?.isRunning()) {
    manager.requestSync();
  }
}

/**
 * "Đồng bộ ngay" (F6): sends pending changes and pulls server changes now.
 * Resolves true when the pull finished and moved the last-synced time.
 */
export async function syncNow(): Promise<boolean> {
  const before = readLastSyncedAt();
  requestSync();
  await runPullWorker();
  const after = readLastSyncedAt();
  return after !== null && after !== before;
}

export function startAppSync(): void {
  const syncManager = ensureManager();
  if (syncManager.isRunning()) {
    return;
  }
  syncManager.start();
  subscription?.remove();
  subscription = AppState.addEventListener('change', onAppStateChange);
  startPullWorker();
}

export function stopAppSync(): void {
  subscription?.remove();
  subscription = null;
  manager?.stop();
  stopPullWorker();
}
