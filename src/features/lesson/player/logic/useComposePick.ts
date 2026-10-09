import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {createRequestId} from '@core/api/requestId';
import type {ComposeQuota, LessonSnapshot} from '@core/schemas/lesson';

import {
  fetchComposeCapability,
  fetchComposeQuota,
  submitCompose,
} from './composeClient';
import {
  type ComposePickIssue,
  composePickIssue,
  picksFarApart,
  togglePick,
} from './composePick';
import {
  type ComposeEntry,
  dismissCompose,
  pollCompose,
  runningComposeFor,
  trackCompose,
  useComposeTracker,
} from './composeTracker';

/** Wait design §3.2: the open sheet polls its request every 2 seconds. */
export const COMPOSE_SHEET_POLL_MS = 2_000;

export type ComposePickPhase =
  | {kind: 'pick'}
  | {kind: 'sending'}
  /** Following a request; its live state is the tracker entry. */
  | {kind: 'following'; requestId: string}
  /** The same pick was composed before: open that lesson (free). */
  | {kind: 'cached'; lessonId: string}
  /** Refused before any AI call (never charged). */
  | {kind: 'refused'; code: string; details?: Record<string, unknown>}
  /** The request did not reach the Server; pressing again reuses the key. */
  | {kind: 'network'};

/**
 * S4.3: one "Học theo 6 bước" pick of one lesson. Holds the picked sentence
 * ids, the App-side checks (J8), the quota line (J2), and the submission
 * with one idempotency key per pick. After the Server accepts, the request is
 * handed to the compose tracker so it keeps going when the sheet closes.
 */
export function useComposePick(snapshot: LessonSnapshot) {
  const [picked, setPicked] = useState<string[]>([]);
  const [phase, setPhase] = useState<ComposePickPhase>({kind: 'pick'});
  const [quota, setQuota] = useState<ComposeQuota | null>(null);
  const keyRef = useRef<{pick: string; key: string} | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // W2: a compose of this lesson already running → show it, not the picker.
  useEffect(() => {
    const running = runningComposeFor(snapshot.id);
    if (running) {
      setPicked(running.sentenceIds);
      setPhase({kind: 'following', requestId: running.requestId});
    }
  }, [snapshot.id]);

  const refreshQuota = useCallback(() => {
    fetchComposeQuota().then(result => {
      if (aliveRef.current && result.ok) setQuota(result.value);
    });
  }, []);

  useEffect(() => {
    refreshQuota();
  }, [refreshQuota]);

  const ordered = useMemo(
    () =>
      [...snapshot.sentences]
        .filter(sentence => picked.includes(sentence.id))
        .sort((a, b) => a.position - b.position),
    [snapshot.sentences, picked],
  );
  const issue: ComposePickIssue = composePickIssue(
    ordered.map(sentence => sentence.text_en),
  );
  const farApart = picksFarApart(ordered.map(sentence => sentence.position));
  const outOfQuota = quota !== null && quota.remaining <= 0;

  const toggle = useCallback((sentenceId: string) => {
    setPicked(current => togglePick(current, sentenceId));
    setPhase(current =>
      current.kind === 'pick' || current.kind === 'refused'
        ? {kind: 'pick'}
        : current,
    );
  }, []);

  const submit = useCallback(async () => {
    const sentenceIds = ordered.map(sentence => sentence.id);
    const pickKey = sentenceIds.join(',');
    // One key per pick: a retry after a network error is the same request.
    if (keyRef.current?.pick !== pickKey) {
      keyRef.current = {pick: pickKey, key: createRequestId()};
    }
    setPhase({kind: 'sending'});
    const result = await submitCompose(
      snapshot.id,
      sentenceIds,
      keyRef.current.key,
    );
    if (!aliveRef.current) return;
    if (!result.ok) {
      if (result.kind === 'network-error') {
        setPhase({kind: 'network'});
        return;
      }
      keyRef.current = null;
      setPhase({
        kind: 'refused',
        code: result.errorCode,
        ...(result.details ? {details: result.details} : {}),
      });
      if (result.errorCode === 'COMPOSE_LIMIT_REACHED') refreshQuota();
      return;
    }
    keyRef.current = null;
    if (result.value.kind === 'cached') {
      setPhase({kind: 'cached', lessonId: result.value.lessonId});
      return;
    }
    trackCompose({
      requestId: result.value.requestId,
      sourceLessonId: snapshot.id,
      sourceTitle: snapshot.title,
      sentenceIds,
    });
    setPhase({kind: 'following', requestId: result.value.requestId});
  }, [ordered, refreshQuota, snapshot.id, snapshot.title]);

  const requestId = phase.kind === 'following' ? phase.requestId : null;

  /** Back to picking with the same sentences (J8: keep the selection). */
  const repick = useCallback(() => {
    if (requestId) dismissCompose(requestId);
    setPhase({kind: 'pick'});
    refreshQuota();
  }, [refreshQuota, requestId]);

  /** Send the same pick again after a failure that allows a retry. */
  const retry = useCallback(() => {
    if (requestId) dismissCompose(requestId);
    keyRef.current = null;
    submit().catch(() => {});
  }, [requestId, submit]);

  const entry: ComposeEntry | null = useComposeTracker(state =>
    requestId
      ? state.entries.find(item => item.requestId === requestId) ?? null
      : null,
  );

  // While the sheet shows a running request, poll it every 2 seconds.
  const running = entry?.status === 'running';
  useEffect(() => {
    if (!requestId || !running) return undefined;
    const handle = setInterval(() => {
      pollCompose(requestId).catch(() => {});
    }, COMPOSE_SHEET_POLL_MS);
    return () => clearInterval(handle);
  }, [requestId, running]);

  const canSubmit =
    phase.kind !== 'sending' &&
    phase.kind !== 'following' &&
    issue === null &&
    !outOfQuota;

  return {
    picked,
    pickedSentences: ordered,
    toggle,
    issue,
    farApart,
    quota,
    outOfQuota,
    phase,
    entry,
    canSubmit,
    submit,
    repick,
    retry,
  };
}

/**
 * `lessons.compose.enabled` from the Server, read once per screen; false
 * until it answers and on any failure (the entry stays hidden).
 */
export function useComposeAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetchComposeCapability({signal: controller.signal}).then(value => {
      if (!controller.signal.aborted) setAvailable(value);
    });
    return () => controller.abort();
  }, []);
  return available;
}
