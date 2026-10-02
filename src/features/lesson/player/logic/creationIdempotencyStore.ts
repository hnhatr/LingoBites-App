import AsyncStorage from '@react-native-async-storage/async-storage';

import {createRequestId} from '@core/api/requestId';
import type {LearnerLessonCreationRequestBody} from '@core/schemas/lesson';

/**
 * Persisted creation idempotency keys (LING-149, LING-210 INV-001/INV-002).
 *
 * Each key is bound to a trimmed content identity (YouTube URL or text body)
 * for one screen-owned submission id. Retries reuse the key only when the
 * content is unchanged; a different trimmed link always mints a new key before
 * POST. Explicit "thử lại" rotates the key for the same content.
 */
const CREATION_IDEMPOTENCY_PREFIX = 'lesson-creation-idempotency:';

type Binding = {
  contentKey: string;
  idempotencyKey: string;
};

const memoryBySubmission = new Map<string, Binding>();

function storageKeyFor(submissionId: string): string {
  return `${CREATION_IDEMPOTENCY_PREFIX}${submissionId}`;
}

function storageOrNull(): typeof AsyncStorage | null {
  try {
    return AsyncStorage ?? null;
  } catch {
    return null;
  }
}

/** Stable trimmed identity for idempotency (YouTube URL or text/OCR body). */
export function contentKeyForBody(
  body: LearnerLessonCreationRequestBody,
): string {
  if (body.source === 'youtube') {
    return `youtube:${body.url.trim()}`;
  }
  return `${body.source}:${body.text.trim()}`;
}

function parseStoredBinding(raw: string): Binding | null {
  try {
    const parsed = JSON.parse(raw) as Binding;
    if (
      typeof parsed.contentKey === 'string' &&
      parsed.contentKey.length > 0 &&
      typeof parsed.idempotencyKey === 'string' &&
      parsed.idempotencyKey.length > 0
    ) {
      return parsed;
    }
  } catch {
    // Legacy plain UUID entries are not bound to content — treat as absent.
  }
  return null;
}

async function readBinding(submissionId: string): Promise<Binding | null> {
  const memory = memoryBySubmission.get(submissionId);
  if (memory) return memory;

  const storage = storageOrNull();
  if (!storage) return null;
  try {
    const raw = await storage.getItem(storageKeyFor(submissionId));
    if (!raw || raw.length === 0) return null;
    const binding = parseStoredBinding(raw);
    if (binding) {
      memoryBySubmission.set(submissionId, binding);
      return binding;
    }
  } catch {
    return null;
  }
  return null;
}

async function persistBinding(
  submissionId: string,
  binding: Binding,
): Promise<void> {
  memoryBySubmission.set(submissionId, binding);
  const storage = storageOrNull();
  if (!storage) return;
  try {
    await storage.setItem(storageKeyFor(submissionId), JSON.stringify(binding));
  } catch {
    // Best-effort; in-memory binding still fences this attempt.
  }
}

/**
 * Reuse the stored key when the content matches; otherwise mint and bind fresh.
 */
export async function getOrCreateCreationIdempotencyKey(
  submissionId: string,
  contentKey: string,
): Promise<string> {
  const existing = await readBinding(submissionId);
  if (existing && existing.contentKey === contentKey) {
    return existing.idempotencyKey;
  }

  const fresh = createRequestId();
  const binding = {contentKey, idempotencyKey: fresh};
  await persistBinding(submissionId, binding);
  return fresh;
}

/** Mint a fresh key for an explicit retry after a terminal failure. */
export async function rotateCreationIdempotencyKey(
  submissionId: string,
  contentKey: string,
): Promise<string> {
  const fresh = createRequestId();
  const binding = {contentKey, idempotencyKey: fresh};
  await persistBinding(submissionId, binding);
  return fresh;
}

/** Forget the key once the submission reaches a terminal success state. */
export async function clearCreationIdempotencyKey(
  submissionId: string,
): Promise<void> {
  memoryBySubmission.delete(submissionId);
  const storage = storageOrNull();
  if (!storage) return;
  try {
    await storage.removeItem(storageKeyFor(submissionId));
  } catch {
    // Best-effort cleanup.
  }
}

/** Test-only: clears in-memory bindings between cases. */
export function resetCreationIdempotencyMemoryForTests(): void {
  memoryBySubmission.clear();
}
