/**
 * Import-state store (SETE-107 / M2).
 *
 * Tiny pub-sub that holds the most recent and in-flight import progress.
 * Mirrors the project's `useReviewState` / sync-outbox style: the React hook
 * (added in a later UI task) subscribes here, and the same shape is also
 * used by tests via `getImportState()`.
 *
 * The store is process-singleton, not persisted; surviving a process kill
 * mid-import is handled by the importer's atomicity guarantees, not by
 * resurrecting in-flight state.
 */

import type {
  ContentPackageImportFailure,
  ContentPackageImportListener,
  ContentPackageImportProgress,
  ContentPackageImportState,
  ContentPackageImportSuccess,
  ContentPackageProgressListener,
} from './types';

let current: ContentPackageImportProgress | null = null;
let lastSuccess: ContentPackageImportSuccess | null = null;
let lastFailure: ContentPackageImportFailure | null = null;

const listeners = new Set<ContentPackageImportListener>();
const progressListeners = new Set<ContentPackageProgressListener>();

function emitProgress(progress: ContentPackageImportProgress): void {
  current = progress;
  for (const listener of listeners) {
    listener(getImportState());
  }
  for (const listener of progressListeners) {
    listener(progress);
  }
}

export function getImportState(): ContentPackageImportState {
  return {current, lastSuccess, lastFailure};
}

export function subscribeImportState(
  listener: ContentPackageImportListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subscribeImportProgress(
  listener: ContentPackageProgressListener,
): () => void {
  progressListeners.add(listener);
  return () => {
    progressListeners.delete(listener);
  };
}

export function startImport(initial: ContentPackageImportProgress): void {
  current = initial;
  lastSuccess = null;
  lastFailure = null;
  for (const listener of listeners) {
    listener(getImportState());
  }
  for (const listener of progressListeners) {
    listener(initial);
  }
}

export function reportProgress(progress: ContentPackageImportProgress): void {
  emitProgress(progress);
}

export function reportSuccess(success: ContentPackageImportSuccess): void {
  lastSuccess = success;
  lastFailure = null;
  current = {
    phase: 'completed',
    ratio: 1,
    message: `Imported ${success.packageSlug} (${success.lessonCount} lessons)`,
    error: null,
  };
  for (const listener of listeners) {
    listener(getImportState());
  }
  for (const listener of progressListeners) {
    listener(current);
  }
}

export function reportFailure(failure: ContentPackageImportFailure): void {
  lastSuccess = null;
  lastFailure = failure;
  current = {
    phase: 'failed',
    ratio: current?.ratio ?? null,
    message: failure.error.message,
    error: failure.error,
  };
  for (const listener of listeners) {
    listener(getImportState());
  }
  for (const listener of progressListeners) {
    listener(current);
  }
}

/** Test/utility helper: drop all subscribers and state. */
export function __resetImportStateForTests(): void {
  current = null;
  lastSuccess = null;
  lastFailure = null;
  listeners.clear();
  progressListeners.clear();
}
