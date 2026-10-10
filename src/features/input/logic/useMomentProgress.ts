import {useCallback, useEffect, useRef, useState} from 'react';

import {
  type CanonicalLessonError,
  fetchLessonCreationStatus,
} from '@features/lesson/player';

import type {LessonCreationStatusResponse} from '@core/schemas/lesson';

const POLL_MS = 1000;
const TERMINAL = new Set(['succeeded', 'failed']);

/**
 * E3: follows one moment request. Polls once a second while it runs, stops at
 * "awaiting_confirmation" (the learner answers, then `resume` polls again) and at
 * the end. Every poll reads the server, so the state survives an app restart.
 */
export function useMomentProgress(requestId: string | null) {
  const [status, setStatus] = useState<LessonCreationStatusResponse | null>(
    null,
  );
  const [error, setError] = useState<CanonicalLessonError | null>(null);
  const [polling, setPolling] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPolling(false);
  }, []);

  const resume = useCallback(() => {
    if (!requestId) return;
    setPolling(true);
    setError(null);
  }, [requestId]);

  useEffect(() => {
    if (!requestId) {
      setStatus(null);
      return undefined;
    }
    setStatus(null);
    resume();
    return stop;
  }, [requestId, resume, stop]);

  useEffect(() => {
    if (!requestId || !polling) return undefined;
    let cancelled = false;
    const tick = async () => {
      const result = await fetchLessonCreationStatus(requestId);
      if (cancelled) return;
      if (!result.ok) {
        setError(result);
        stop();
        return;
      }
      setStatus(result.value);
      const next = result.value.status;
      if (TERMINAL.has(next) || next === 'awaiting_confirmation') {
        stop();
        return;
      }
      timer.current = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [requestId, polling, stop]);

  return {status, error, polling, resume};
}
