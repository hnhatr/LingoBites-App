import {useCallback, useEffect, useRef, useState} from 'react';

import type {
  LearnerLessonCreationRequestBody,
  LessonCreationStatus,
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
  | {
      status: 'waiting_transcript';
      requestId: string;
      polling: boolean;
    }
  | {status: 'succeeded'; requestId: string; lessonId: string}
  | {
      status: 'failed';
      requestId: string;
      code: string;
      retryable: boolean;
    }
  | {
      status: 'timedOut';
      requestId: string;
    }
  | {status: 'error'; error: CanonicalLessonError};

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 60;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isTerminalStatus(status: LessonCreationStatus): boolean {
  return status === 'succeeded' || status === 'failed';
}

type PollOutcome =
  | {kind: 'terminal'; value: LessonCreationStatusResponse}
  | {kind: 'timeout'; endedWhileWaiting: boolean}
  | {kind: 'error'; error: CanonicalLessonError}
  | {kind: 'cancelled'};

async function pollUntilTerminal(
  requestId: string,
  shouldContinue: () => boolean,
  onNonTerminal: (status: LessonCreationStatus) => void,
): Promise<PollOutcome> {
  let endedWhileWaiting = false;
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
    if (!shouldContinue()) return {kind: 'cancelled'};
    const polled = await fetchLessonCreationStatus(requestId);
    if (!shouldContinue()) return {kind: 'cancelled'};
    if (!polled.ok) return {kind: 'error', error: polled};
    const {status} = polled.value;
    if (isTerminalStatus(status)) {
      return {kind: 'terminal', value: polled.value};
    }
    if (status === 'waiting_transcript') {
      endedWhileWaiting = true;
    } else {
      endedWhileWaiting = false;
    }
    onNonTerminal(status);
    await sleep(POLL_INTERVAL_MS);
  }
  return {kind: 'timeout', endedWhileWaiting};
}

async function applyTerminalOutcome(
  terminal: LessonCreationStatusResponse,
  requestId: string,
  submissionId: string,
  shouldContinue: () => boolean,
  setState: (state: LessonCreationState) => void,
): Promise<void> {
  if (terminal.status === 'succeeded' && terminal.lesson_id) {
    await clearCreationIdempotencyKey(submissionId);
    if (!shouldContinue()) return;
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
}

function uiStateForNonTerminal(
  requestId: string,
  status: LessonCreationStatus,
  polling: boolean,
): LessonCreationState {
  if (status === 'waiting_transcript') {
    return {status: 'waiting_transcript', requestId, polling};
  }
  return {status: 'processing', requestId};
}

/**
 * Learner creation flow (AD-003, INV-006): submit text/OCR/YouTube with the
 * persisted idempotency key, then poll until `succeeded` or `failed`. A
 * network retry reuses the same key; only an explicit retry after a terminal
 * failure rotates it.
 */
export function useLessonCreation(submissionId: string) {
  const [state, setState] = useState<LessonCreationState>({status: 'idle'});
  const aliveRef = useRef(true);
  const pollGenerationRef = useRef(0);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      pollGenerationRef.current += 1;
    };
  }, []);

  const safeSetState = useCallback((next: LessonCreationState) => {
    if (aliveRef.current) setState(next);
  }, []);

  const runPollForRequest = useCallback(
    async (requestId: string) => {
      const generation = pollGenerationRef.current + 1;
      pollGenerationRef.current = generation;
      const shouldContinue = () =>
        aliveRef.current && pollGenerationRef.current === generation;

      const onNonTerminal = (status: LessonCreationStatus) => {
        safeSetState(uiStateForNonTerminal(requestId, status, true));
      };

      const outcome = await pollUntilTerminal(
        requestId,
        shouldContinue,
        onNonTerminal,
      );
      if (!shouldContinue()) return;

      if (outcome.kind === 'timeout') {
        if (outcome.endedWhileWaiting) {
          safeSetState({
            status: 'waiting_transcript',
            requestId,
            polling: false,
          });
        } else {
          safeSetState({status: 'timedOut', requestId});
        }
        return;
      }
      if (outcome.kind === 'error') {
        safeSetState({status: 'error', error: outcome.error});
        return;
      }
      if (outcome.kind === 'terminal') {
        await applyTerminalOutcome(
          outcome.value,
          requestId,
          submissionId,
          shouldContinue,
          safeSetState,
        );
      }
    },
    [safeSetState, submissionId],
  );

  const submit = useCallback(
    async (body: LearnerLessonCreationRequestBody) => {
      safeSetState({status: 'submitting'});
      const idempotencyKey = await getOrCreateCreationIdempotencyKey(
        submissionId,
      );
      if (!aliveRef.current) return;
      const accepted = await submitLessonCreation(body, idempotencyKey);
      if (!aliveRef.current) return;
      if (!accepted.ok) {
        safeSetState({status: 'error', error: accepted});
        return;
      }
      const {requestId, status} = accepted.value;
      safeSetState(
        uiStateForNonTerminal(requestId, status as LessonCreationStatus, true),
      );
      await runPollForRequest(requestId);
    },
    [runPollForRequest, safeSetState, submissionId],
  );

  /** Resume polling the same creation request after a client-side timeout. */
  const checkAgain = useCallback(async () => {
    if (state.status !== 'timedOut' && state.status !== 'waiting_transcript') {
      return;
    }
    const requestId = state.requestId;
    if (state.status === 'waiting_transcript') {
      safeSetState({status: 'waiting_transcript', requestId, polling: true});
    } else {
      safeSetState({status: 'processing', requestId});
    }
    await runPollForRequest(requestId);
  }, [runPollForRequest, safeSetState, state]);

  /** Explicit "thử lại" after a terminal failure: rotate the key. */
  const retryWithFreshKey = useCallback(async () => {
    await rotateCreationIdempotencyKey(submissionId);
    safeSetState({status: 'idle'});
  }, [safeSetState, submissionId]);

  return {state, submit, checkAgain, retryWithFreshKey};
}
