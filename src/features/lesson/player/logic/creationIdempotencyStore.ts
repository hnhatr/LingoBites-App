import AsyncStorage from '@react-native-async-storage/async-storage';

import {createRequestId} from '@core/api/requestId';

/**
 * Persisted creation idempotency keys (LING-149 TASK-007, INV-006).
 *
 * The same submission reuses its key on network retry so a retried POST can
 * never yield a second request or lesson; only an explicit "thử lại" after a
 * terminal failure mints a fresh key. Keys are stored per stable submission
 * id (screen-owned), so a kill/restart keeps reusing the same key until the
 * submission either succeeds or the user explicitly retries.
 */
const CREATION_IDEMPOTENCY_PREFIX = 'lesson-creation-idempotency:';

function keyFor(submissionId: string): string {
  return `${CREATION_IDEMPOTENCY_PREFIX}${submissionId}`;
}

function storageOrNull(): typeof AsyncStorage | null {
  try {
    return AsyncStorage ?? null;
  } catch {
    return null;
  }
}

/** Reuse the stored key for this submission, minting one when absent. */
export async function getOrCreateCreationIdempotencyKey(
  submissionId: string,
): Promise<string> {
  const storage = storageOrNull();
  const storageKey = keyFor(submissionId);
  if (storage) {
    try {
      const existing = await storage.getItem(storageKey);
      if (existing && existing.length > 0) return existing;
    } catch {
      // Fall through to minting a fresh in-memory key.
    }
  }
  const fresh = createRequestId();
  if (storage) {
    try {
      await storage.setItem(storageKey, fresh);
    } catch {
      // Persistence is best-effort; the fresh key still fences this attempt.
    }
  }
  return fresh;
}

/** Mint a fresh key for an explicit retry after a terminal failure. */
export async function rotateCreationIdempotencyKey(
  submissionId: string,
): Promise<string> {
  const fresh = createRequestId();
  const storage = storageOrNull();
  if (storage) {
    try {
      await storage.setItem(keyFor(submissionId), fresh);
    } catch {
      // Best-effort; the fresh key still fences the retry.
    }
  }
  return fresh;
}

/** Forget the key once the submission reaches a terminal state. */
export async function clearCreationIdempotencyKey(
  submissionId: string,
): Promise<void> {
  const storage = storageOrNull();
  if (!storage) return;
  try {
    await storage.removeItem(keyFor(submissionId));
  } catch {
    // Best-effort cleanup.
  }
}
