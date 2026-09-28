/**
 * Unified generation-job polling hook over `fetchLessonGenerationJob`,
 * extended with targeted part retry over `retryLessonJobPart`.
 *
 * Polls only job status (never content) pacing each round by the
 * server's `pollAfterMs` clamped to sane bounds, with an overall
 * deadline. Stops at terminal status (`ready`, `ready_with_warnings`
 * with a materialized `lessonId`, or `failed`). Stale-poll safe: only
 * the latest in-flight round can commit state, and unmount/cancel
 * aborts the loop without committing.
 *
 * Part retry sends exactly one target with the last observed job
 * revision and a fresh per-operation idempotency key. On success the
 * returned snapshot replaces local state (successful parts stay as the
 * server returned them) and polling resumes. On 409 conflict the hook
 * refetches the current snapshot instead of minting another mutation.
 * In-flight retry suppression is UX only — correctness stays
 * server-enforced.
 */
import {useCallback, useEffect, useRef, useState} from 'react';
import {createRequestId} from '@shared/api/requestId';
import {
  fetchLessonGenerationJob,
  isLessonGenerationTerminal,
  retryLessonJobPart,
  type LessonGenerationJob,
  type LessonGenerationPartTarget,
  type LessonJobError,
} from './lessonJobClient';

const POLL_AFTER_MIN_MS = 500;
const POLL_AFTER_MAX_MS = 15_000;
const POLL_DEADLINE_MS = 5 * 60_000;

export type LessonGenerationState =
  | {status: 'polling'; job: LessonGenerationJob | null}
  | {status: 'succeeded'; job: LessonGenerationJob; lessonId: string}
  | {status: 'failed'; job: LessonGenerationJob | null; error: LessonJobError};

export type UseLessonGenerationJobOptions = {
  jobId: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

export type PartRetryOutcome =
  | {ok: true; job: LessonGenerationJob}
  | {
      ok: false;
      error: LessonJobError;
      conflicted: boolean;
      job: LessonGenerationJob | null;
    };

export type UseLessonGenerationJobResult = {
  generation: LessonGenerationState;
  retrying: LessonGenerationPartTarget | null;
  retryPart: (
    target: LessonGenerationPartTarget,
    retryOptions?: {idempotencyKey?: string},
  ) => Promise<PartRetryOutcome>;
};

function clampPollAfterMs(pollAfterMs: number): number {
  if (!Number.isFinite(pollAfterMs)) return POLL_AFTER_MIN_MS;
  return Math.min(POLL_AFTER_MAX_MS, Math.max(POLL_AFTER_MIN_MS, pollAfterMs));
}

function waitFor(ms: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve(true);
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      resolve(false);
    };
    signal.addEventListener('abort', onAbort, {once: true});
  });
}

function terminalState(job: LessonGenerationJob): LessonGenerationState {
  if (job.status === 'failed' || !job.lessonId) {
    return {
      status: 'failed',
      job,
      error: {
        ok: false,
        kind: 'server-error',
        errorCode: job.error?.code ?? 'GENERATION_FAILED',
        message: job.error?.message ?? 'Lesson generation failed. Try again.',
        retryable: true,
      },
    };
  }
  return {status: 'succeeded', job, lessonId: job.lessonId};
}

export function useLessonGenerationJob(
  options: UseLessonGenerationJobOptions,
): UseLessonGenerationJobResult {
  const {jobId, fetchImpl, now = Date.now} = options;
  const [generation, setGeneration] = useState<LessonGenerationState>({
    status: 'polling',
    job: null,
  });
  const [retrying, setRetrying] = useState<LessonGenerationPartTarget | null>(
    null,
  );
  const roundRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const retryingRef = useRef(false);
  const jobRef = useRef<LessonGenerationJob | null>(null);

  const commit = useCallback((next: LessonGenerationState) => {
    jobRef.current = next.job;
    setGeneration(next);
  }, []);

  const poll = useCallback(async () => {
    const round = roundRef.current + 1;
    roundRef.current = round;
    const controller = new AbortController();
    controllerRef.current = controller;
    const deadline = now() + POLL_DEADLINE_MS;
    let delay = POLL_AFTER_MIN_MS;
    const isCurrent = () => roundRef.current === round;

    // First snapshot immediately; subsequent rounds wait first.
    let first = true;
    while (now() < deadline) {
      if (!first) {
        const waited = await waitFor(
          Math.min(delay, Math.max(0, deadline - now())),
          controller.signal,
        );
        if (!waited || !isCurrent()) return;
      }
      first = false;
      const result = await fetchLessonGenerationJob(jobId, {
        fetchImpl,
        signal: controller.signal,
      });
      if (!isCurrent()) return;
      if (!result.ok) {
        if (result.cancelled) return;
        commit({
          status: 'failed',
          job: null,
          error: result.retryable
            ? result
            : {
                ...result,
                retryable: true,
              },
        });
        return;
      }
      const {job} = result;
      if (isLessonGenerationTerminal(job)) {
        commit(terminalState(job));
        return;
      }
      delay = clampPollAfterMs(job.pollAfterMs);
      commit({status: 'polling', job});
    }
    if (isCurrent()) {
      commit({
        status: 'failed',
        job: null,
        error: {
          ok: false,
          kind: 'network-error',
          errorCode: 'POLLING_TIMEOUT',
          message: 'Generation is taking too long. Try again.',
          retryable: true,
        },
      });
    }
  }, [jobId, fetchImpl, now, commit]);

  const retryPart = useCallback(
    async (
      target: LessonGenerationPartTarget,
      retryOptions: {idempotencyKey?: string} = {},
    ): Promise<PartRetryOutcome> => {
      const run = roundRef.current;
      const isCurrent = () => roundRef.current === run;
      if (retryingRef.current) {
        return {
          ok: false,
          error: {
            ok: false,
            kind: 'network-error',
            errorCode: 'RETRY_IN_FLIGHT',
            message: 'A retry is already running.',
            retryable: false,
          },
          conflicted: false,
          job: jobRef.current,
        };
      }
      const observed = jobRef.current;
      if (!observed) {
        return {
          ok: false,
          error: {
            ok: false,
            kind: 'invalid-input',
            errorCode: 'NO_JOB_SNAPSHOT',
            message: 'No job status yet. Wait and try again.',
            retryable: false,
          },
          conflicted: false,
          job: null,
        };
      }
      retryingRef.current = true;
      setRetrying(target);
      const release = () => {
        retryingRef.current = false;
        if (isCurrent()) setRetrying(null);
      };
      try {
        const result = await retryLessonJobPart(
          {
            jobId,
            target,
            expectedRevision: observed.revision,
            idempotencyKey: retryOptions.idempotencyKey ?? createRequestId(),
          },
          {fetchImpl},
        );
        if (!isCurrent()) {
          return result.ok
            ? {ok: true, job: result.job}
            : {
                ok: false,
                error: result,
                conflicted: result.kind === 'conflict',
                job: jobRef.current,
              };
        }
        if (result.ok) {
          commit({status: 'polling', job: result.job});
          release();
          void poll();
          return {ok: true, job: result.job};
        }
        if (result.cancelled) {
          return {
            ok: false,
            error: result,
            conflicted: false,
            job: jobRef.current,
          };
        }
        if (result.kind === 'conflict') {
          const refetched = await fetchLessonGenerationJob(jobId, {
            fetchImpl,
          });
          if (!isCurrent()) {
            return {
              ok: false,
              error: result,
              conflicted: true,
              job: jobRef.current,
            };
          }
          if (refetched.ok) {
            const {job} = refetched;
            if (isLessonGenerationTerminal(job)) {
              commit(terminalState(job));
            } else {
              commit({status: 'polling', job});
              release();
              void poll();
            }
            return {
              ok: false,
              error: result,
              conflicted: true,
              job,
            };
          }
          if (!refetched.cancelled) {
            commit({
              status: 'failed',
              job: null,
              error: refetched.retryable
                ? refetched
                : {...refetched, retryable: true},
            });
          }
          return {
            ok: false,
            error: result,
            conflicted: true,
            job: null,
          };
        }
        return {
          ok: false,
          error: result,
          conflicted: false,
          job: jobRef.current,
        };
      } finally {
        release();
      }
    },
    [jobId, fetchImpl, commit, poll],
  );

  useEffect(() => {
    commit({status: 'polling', job: null});
    setRetrying(null);
    retryingRef.current = false;
    void poll();
    return () => {
      roundRef.current += 1;
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, [poll, commit]);

  return {generation, retrying, retryPart};
}
