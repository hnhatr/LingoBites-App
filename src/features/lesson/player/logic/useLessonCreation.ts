import {useCallback, useState} from 'react';

import type {
  LearnerLessonCreationRequestBody,
  LessonCreationStatusResponse,
} from '@core/schemas/lesson';

import {
  type CanonicalLessonError,
  fetchLessonCreationStatus,
  submitLessonCreation,
} from './canonicalLessonClient';
import {
  clearCreationIdempotencyKey,
  getOrCreateCreationIdempotencyKey,
  rotateCreationIdempotencyKey,
} from './creationIdempotencyStore';

export type LessonCreationState =
  | {status: 'idle'}
  | {status: 'submitting'}
  | {status: 'processing'; requestId: string}
  | {status: 'succeeded'; requestId: string; lessonId: string}
  | {
      status: 'failed';
      requestId: string;
      code: string;
      retryable: boolean;
    }
  | {status: 'error'; error: CanonicalLessonError};

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 60;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Learner creation flow (AD-003, INV-006): submit text/OCR/YouTube with the
 * persisted idempotency key, then poll until `succeeded` or `failed`. A
 * network retry reuses the same key; only an explicit retry after a terminal
 * failure rotates it.
 */
export function useLessonCreation(submissionId: string) {
  const [state, setState] = useState<LessonCreationState>({status: 'idle'});

  const submit = useCallback(
    async (body: LearnerLessonCreationRequestBody) => {
      setState({status: 'submitting'});
      const idempotencyKey = await getOrCreateCreationIdempotencyKey(
        submissionId,
      );
      const accepted = await submitLessonCreation(body, idempotencyKey);
      if (!accepted.ok) {
        setState({status: 'error', error: accepted});
        return;
      }
      const requestId = accepted.value.requestId;
      setState({status: 'processing', requestId});
      let terminal: LessonCreationStatusResponse | null = null;
      for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
        const polled = await fetchLessonCreationStatus(requestId);
        if (!polled.ok) {
          setState({status: 'error', error: polled});
          return;
        }
        if (
          polled.value.status === 'succeeded' ||
          polled.value.status === 'failed'
        ) {
          terminal = polled.value;
          break;
        }
        await sleep(POLL_INTERVAL_MS);
      }
      if (!terminal) return;
      if (terminal.status === 'succeeded' && terminal.lesson_id) {
        await clearCreationIdempotencyKey(submissionId);
        setState({
          status: 'succeeded',
          requestId,
          lessonId: terminal.lesson_id,
        });
        return;
      }
      setState({
        status: 'failed',
        requestId,
        code: terminal.error?.code ?? 'CREATION_FAILED',
        retryable: terminal.error?.retryable ?? true,
      });
    },
    [submissionId],
  );

  /** Explicit "thử lại" after a terminal failure: rotate the key. */
  const retryWithFreshKey = useCallback(async () => {
    await rotateCreationIdempotencyKey(submissionId);
    setState({status: 'idle'});
  }, [submissionId]);

  return {state, submit, retryWithFreshKey};
}
