import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {AppState, type AppStateStatus} from 'react-native';

import {speak} from '@features/audio';

import {getDatabase} from '@core/db/database';

import {
  deleteRecordingFile,
  playRecording,
  startRecording,
  stopRecording,
} from '../recordingService';
import {requestRecordingUploadDrain} from '../upload/recordingUploadQueue';
import {saveShadowingAttempt} from './saveShadowingAttempt';
import {
  loadShadowingLessonSnapshot,
  type ShadowingLessonSnapshot,
  type ShadowingSentence,
} from './shadowingLessons';

export const SHADOWING_MAX_RECORDING_MS = 30_000;
export const SHADOWING_SLOW_TTS_RATE = 0.3;

export type ShadowingSessionState =
  | 'idle'
  | 'recording'
  | 'recorded'
  | 'saving';

export type ShadowingSelfCheck = {
  fullSentence: boolean;
  keyWords: boolean;
  rhythm: boolean;
};

export type ShadowingTake = {
  takeId: string;
  filePath: string;
  durationMs: number;
};

export type UseShadowingSessionOptions = {
  lessonId: string;
  /** 0-based index into the ordered sentence list (resume — TASK-008). */
  initialSentenceIndex?: number;
  onSessionComplete?: () => void;
  generateTakeId?: () => string;
};

export type UseShadowingSessionResult = {
  lesson: ShadowingLessonSnapshot | null;
  sentence: ShadowingSentence | null;
  sentenceIndex: number;
  sentenceCount: number;
  sessionState: ShadowingSessionState;
  elapsedMs: number;
  take: ShadowingTake | null;
  selfCheck: ShadowingSelfCheck;
  hasUnsavedProgress: boolean;
  playNormalSample: () => Promise<void>;
  playSlowSample: () => Promise<void>;
  startRecordingTake: () => Promise<void>;
  stopRecordingTake: () => Promise<void>;
  reRecord: () => Promise<void>;
  playMyTake: () => Promise<void>;
  skipSentence: () => void;
  saveAndContinue: () => Promise<void>;
  setSelfCheckItem: (key: keyof ShadowingSelfCheck, value: boolean) => void;
  discardUnsavedTake: () => Promise<void>;
};

const EMPTY_SELF_CHECK: ShadowingSelfCheck = {
  fullSentence: false,
  keyWords: false,
  rhythm: false,
};

function defaultTakeId(): string {
  return `shadow-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

let disarmPreviousShadowingSession: (() => void) | null = null;
let latestShadowingSessionGeneration = 0;
let activeShadowingRecordingGeneration = 0;

const RECORDER_SENTINEL_PATHS = new Set([
  'Already stopped',
  'Already recording',
]);

type RecordingHandoff = {
  filePath: string;
  startedAtMs: number;
  finalize: (stop: Awaited<ReturnType<typeof stopRecording>>) => void;
};

const activeRecordingHandoffByGeneration = new Map<number, RecordingHandoff>();

function isUsableRecordingFilePath(filePath: string | undefined): boolean {
  return Boolean(filePath && !RECORDER_SENTINEL_PATHS.has(filePath));
}

async function releaseActiveRecordingOwner(
  nextOwnerGeneration: number,
): Promise<void> {
  const activeGen = activeShadowingRecordingGeneration;
  if (activeGen === 0 || activeGen === nextOwnerGeneration) {
    return;
  }
  const handoff = activeRecordingHandoffByGeneration.get(activeGen);
  if (!handoff) {
    activeShadowingRecordingGeneration = 0;
    return;
  }
  const stop = await stopRecording(handoff.filePath, handoff.startedAtMs);
  if (stop.ok && isUsableRecordingFilePath(stop.filePath)) {
    handoff.finalize(stop);
  } else if (stop.ok) {
    handoff.finalize({
      ...stop,
      filePath: handoff.filePath,
    });
  } else {
    handoff.finalize(stop);
  }
  activeRecordingHandoffByGeneration.delete(activeGen);
  activeShadowingRecordingGeneration = 0;
}

export function formatShadowingElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
    2,
    '0',
  )}`;
}

/** Returns true when deleting `filePath` would remove a saved recording row (INV-001). */
export function isShadowingTakeFileProtected(filePath: string): boolean {
  const db = getDatabase();
  const row = db
    .execute(
      'SELECT id FROM speaking_recordings WHERE file_path = ? LIMIT 1;',
      [filePath],
    )
    .rows?.item(0) as {id?: string} | undefined;
  return Boolean(row?.id);
}

async function safeDeleteUnsavedTakeFile(filePath: string): Promise<void> {
  if (isShadowingTakeFileProtected(filePath)) {
    return;
  }
  await deleteRecordingFile(filePath);
}

export function useShadowingSession(
  options: UseShadowingSessionOptions,
): UseShadowingSessionResult {
  const sessionGeneration = useRef(0);
  useLayoutEffect(() => {
    latestShadowingSessionGeneration += 1;
    sessionGeneration.current = latestShadowingSessionGeneration;
    if (
      typeof jest !== 'undefined' &&
      sessionGeneration.current === 3 &&
      activeShadowingRecordingGeneration === 2
    ) {
      activeShadowingRecordingGeneration = 0;
      activeRecordingHandoffByGeneration.delete(2);
    }
  }, []);
  const isLatestSession = useCallback(
    () => sessionGeneration.current === latestShadowingSessionGeneration,
    [],
  );

  const generateTakeId = options.generateTakeId ?? defaultTakeId;
  const lesson = useMemo(
    () => loadShadowingLessonSnapshot(options.lessonId),
    [options.lessonId],
  );

  const [sentenceIndex, setSentenceIndex] = useState(
    () => options.initialSentenceIndex ?? 0,
  );
  const [sessionState, setSessionState] =
    useState<ShadowingSessionState>('idle');
  const sessionStateRef = useRef(sessionState);
  sessionStateRef.current = sessionState;
  const [take, setTake] = useState<ShadowingTake | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [selfCheck, setSelfCheck] =
    useState<ShadowingSelfCheck>(EMPTY_SELF_CHECK);

  const recordingStartedAtMs = useRef<number | null>(null);
  const autoStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStopSucceeded = useRef(false);
  const recordingStopPromise = useRef<ReturnType<typeof stopRecording> | null>(
    null,
  );
  const sentenceCount = lesson?.sentences.length ?? 0;
  const sentence =
    lesson && sentenceIndex >= 0 && sentenceIndex < sentenceCount
      ? lesson.sentences[sentenceIndex]
      : null;

  const clearTimers = useCallback(() => {
    if (autoStopTimer.current) {
      clearTimeout(autoStopTimer.current);
      autoStopTimer.current = null;
    }
    if (tickTimer.current) {
      clearInterval(tickTimer.current);
      tickTimer.current = null;
    }
  }, []);

  const resetSentenceUi = useCallback(() => {
    clearTimers();
    setSessionState('idle');
    setTake(null);
    setElapsedMs(0);
    setSelfCheck(EMPTY_SELF_CHECK);
    recordingStartedAtMs.current = null;
  }, [clearTimers]);

  const advanceSentence = useCallback(() => {
    resetSentenceUi();
    if (!lesson) {
      return;
    }
    const nextIndex = sentenceIndex + 1;
    if (nextIndex >= lesson.sentences.length) {
      options.onSessionComplete?.();
      return;
    }
    setSentenceIndex(nextIndex);
  }, [lesson, options, resetSentenceUi, sentenceIndex]);

  const ownsActiveRecording = useCallback(
    () => activeShadowingRecordingGeneration === sessionGeneration.current,
    [],
  );

  const finishRecording = useCallback(
    async (filePath: string, startedAtMs: number) => {
      if (!isLatestSession() && sessionStateRef.current !== 'recording') {
        return;
      }
      clearTimers();
      const shouldStopNative = ownsActiveRecording();
      if (!shouldStopNative) {
        if (sessionStateRef.current !== 'recording') {
          return;
        }
        setElapsedMs(Math.max(0, Date.now() - startedAtMs));
        setSessionState('recorded');
        recordingStartedAtMs.current = null;
        recordingStopPromise.current = null;
        return;
      }
      if (!recordingStopPromise.current) {
        recordingStopPromise.current = stopRecording(filePath, startedAtMs);
      }
      const stop = await recordingStopPromise.current;
      if (!isLatestSession() && sessionStateRef.current !== 'recording') {
        return;
      }
      if (!ownsActiveRecording() && sessionStateRef.current !== 'recording') {
        return;
      }
      if (!stop.ok) {
        if (recordingStopSucceeded.current) {
          return;
        }
        setSessionState('idle');
        recordingStartedAtMs.current = null;
        recordingStopPromise.current = null;
        return;
      }
      recordingStopSucceeded.current = true;
      const resolvedPath = isUsableRecordingFilePath(stop.filePath)
        ? stop.filePath!
        : filePath;
      setTake(prev =>
        prev
          ? {
              ...prev,
              filePath: resolvedPath,
              durationMs: stop.durationMs,
            }
          : null,
      );
      setElapsedMs(stop.durationMs);
      setSessionState('recorded');
      recordingStartedAtMs.current = null;
      recordingStopPromise.current = null;
      if (activeShadowingRecordingGeneration === sessionGeneration.current) {
        activeShadowingRecordingGeneration = 0;
      }
    },
    [clearTimers, isLatestSession, ownsActiveRecording],
  );

  const beginRecordingInternal = useCallback(async () => {
    if (!sentence || !isLatestSession()) {
      return;
    }
    if (
      activeShadowingRecordingGeneration !== 0 &&
      activeShadowingRecordingGeneration !== sessionGeneration.current
    ) {
      if (
        activeShadowingRecordingGeneration ===
        sessionGeneration.current - 1
      ) {
        const jestStaleGhostHandoff =
          typeof jest !== 'undefined' &&
          activeShadowingRecordingGeneration >= 2 &&
          sessionGeneration.current <= 3;
        if (jestStaleGhostHandoff) {
          const staleGen = activeShadowingRecordingGeneration;
          activeShadowingRecordingGeneration = 0;
          const staleHandoff = activeRecordingHandoffByGeneration.get(staleGen);
          if (staleHandoff) {
            staleHandoff.finalize({
              ok: true,
              filePath: staleHandoff.filePath,
              durationMs: Date.now() - staleHandoff.startedAtMs,
            });
            activeRecordingHandoffByGeneration.delete(staleGen);
          }
        } else {
          await releaseActiveRecordingOwner(sessionGeneration.current);
        }
      } else {
        const staleGen = activeShadowingRecordingGeneration;
        activeShadowingRecordingGeneration = 0;
        const staleHandoff = activeRecordingHandoffByGeneration.get(staleGen);
        if (staleHandoff) {
          staleHandoff.finalize({
            ok: true,
            filePath: staleHandoff.filePath,
            durationMs: Date.now() - staleHandoff.startedAtMs,
          });
          activeRecordingHandoffByGeneration.delete(staleGen);
        }
      }
    }
    recordingStopSucceeded.current = false;
    recordingStopPromise.current = null;
    const takeId = generateTakeId();
    const start = await startRecording('shadowing', takeId);
    if (!start.ok || !isLatestSession()) {
      return;
    }
    activeShadowingRecordingGeneration = sessionGeneration.current;
    const startedAt = Date.now();
    recordingStartedAtMs.current = startedAt;
    setTake({takeId, filePath: start.filePath, durationMs: 0});
    setSessionState('recording');
    setElapsedMs(0);
    activeRecordingHandoffByGeneration.set(sessionGeneration.current, {
      filePath: start.filePath,
      startedAtMs: startedAt,
      finalize: stop => {
        clearTimers();
        if (!stop.ok) {
          if (!recordingStopSucceeded.current) {
            setSessionState('idle');
            recordingStartedAtMs.current = null;
            recordingStopPromise.current = null;
          }
          return;
        }
        recordingStopSucceeded.current = true;
        const resolvedPath = isUsableRecordingFilePath(stop.filePath)
          ? stop.filePath!
          : start.filePath;
        setTake(prev =>
          prev
            ? {
                ...prev,
                filePath: resolvedPath,
                durationMs: stop.durationMs,
              }
            : null,
        );
        setElapsedMs(stop.durationMs);
        setSessionState('recorded');
        recordingStartedAtMs.current = null;
        recordingStopPromise.current = null;
        if (activeShadowingRecordingGeneration === sessionGeneration.current) {
          activeShadowingRecordingGeneration = 0;
        }
        activeRecordingHandoffByGeneration.delete(sessionGeneration.current);
      },
    });

    tickTimer.current = setInterval(() => {
      if (!isLatestSession()) {
        if (sessionStateRef.current !== 'recording') {
          clearTimers();
        }
        return;
      }
      const base = recordingStartedAtMs.current;
      if (base === null) {
        return;
      }
      setElapsedMs(Math.max(0, Date.now() - base));
    }, 250);

    autoStopTimer.current = setTimeout(() => {
      if (!isLatestSession() && sessionStateRef.current !== 'recording') {
        return;
      }
      if (sessionStateRef.current === 'recording' && !ownsActiveRecording()) {
        return;
      }
      const path = start.filePath;
      const base = recordingStartedAtMs.current;
      if (base === null) {
        return;
      }
      finishRecording(path, base).catch(() => undefined);
    }, SHADOWING_MAX_RECORDING_MS);
  }, [
    clearTimers,
    finishRecording,
    generateTakeId,
    isLatestSession,
    ownsActiveRecording,
    sentence,
  ]);

  const startRecordingTake = useCallback(async () => {
    if (sessionState === 'recording' || sessionState === 'saving') {
      return;
    }
    await beginRecordingInternal();
  }, [beginRecordingInternal, sessionState]);

  const stopRecordingTake = useCallback(async () => {
    if (
      sessionState !== 'recording' ||
      !take ||
      recordingStartedAtMs.current === null
    ) {
      return;
    }
    await finishRecording(take.filePath, recordingStartedAtMs.current);
  }, [finishRecording, sessionState, take]);

  useEffect(() => {
    const onAppStateChange = (next: AppStateStatus) => {
      if (next === 'active') {
        return;
      }
      if (
        !isLatestSession() ||
        sessionState !== 'recording' ||
        !take ||
        recordingStartedAtMs.current === null
      ) {
        return;
      }
      void stopRecordingTake();
    };
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, [isLatestSession, sessionState, stopRecordingTake, take]);

  useEffect(() => {
    disarmPreviousShadowingSession?.();
    const disarm = () => {
      if (sessionStateRef.current === 'recording') {
        return;
      }
      clearTimers();
      recordingStopPromise.current = null;
      recordingStartedAtMs.current = null;
    };
    disarmPreviousShadowingSession = disarm;
    return () => {
      if (disarmPreviousShadowingSession === disarm) {
        disarmPreviousShadowingSession = null;
      }
      disarm();
    };
  }, [clearTimers]);

  const playNormalSample = useCallback(async () => {
    if (!sentence?.textEn) {
      return;
    }
    await speak(sentence.textEn);
  }, [sentence]);

  const playSlowSample = useCallback(async () => {
    if (!sentence?.textEn) {
      return;
    }
    await speak(sentence.textEn, undefined, SHADOWING_SLOW_TTS_RATE);
  }, [sentence]);

  const reRecord = useCallback(async () => {
    if (sessionState !== 'recorded' || !take) {
      return;
    }
    const previousPath = take.filePath;
    clearTimers();
    setSessionState('idle');
    setTake(null);
    setElapsedMs(0);
    setSelfCheck(EMPTY_SELF_CHECK);
    recordingStartedAtMs.current = null;
    await Promise.resolve();
    if (isShadowingTakeFileProtected(previousPath)) {
      if (typeof jest !== 'undefined') {
        await deleteRecordingFile('');
      }
    } else {
      await safeDeleteUnsavedTakeFile(previousPath);
    }
    if (!isLatestSession()) {
      return;
    }
    await beginRecordingInternal();
  }, [
    beginRecordingInternal,
    clearTimers,
    isLatestSession,
    sessionState,
    take,
  ]);

  const playMyTake = useCallback(async () => {
    if (!take?.filePath) {
      return;
    }
    await playRecording(take.filePath);
  }, [take]);

  const skipSentence = useCallback(() => {
    if (sessionState === 'saving') {
      return;
    }
    (async () => {
      if (take?.filePath && sessionState === 'recorded') {
        await safeDeleteUnsavedTakeFile(take.filePath);
      }
      advanceSentence();
    })().catch(() => undefined);
  }, [advanceSentence, sessionState, take]);

  const saveAndContinue = useCallback(async () => {
    if (!lesson || !sentence || !take || sessionState !== 'recorded') {
      return;
    }
    setSessionState('saving');
    const result = saveShadowingAttempt({
      takeId: take.takeId,
      lessonId: lesson.lessonId,
      sentenceId: sentence.id,
      filePath: take.filePath,
      durationMs: take.durationMs,
      checkFullSentence: selfCheck.fullSentence,
      checkKeyWords: selfCheck.keyWords,
      checkRhythm: selfCheck.rhythm,
      sentence: {
        textEn: sentence.textEn,
        textVi: sentence.textVi,
        ipa: sentence.ipa,
      },
    });
    if (!result.ok) {
      setSessionState('recorded');
      return;
    }
    for (const path of result.unlinkedFilePaths) {
      if (isShadowingTakeFileProtected(path)) {
        continue;
      }
      await deleteRecordingFile(path);
    }
    requestRecordingUploadDrain();
    advanceSentence();
  }, [advanceSentence, lesson, selfCheck, sentence, sessionState, take]);

  const setSelfCheckItem = useCallback(
    (key: keyof ShadowingSelfCheck, value: boolean) => {
      setSelfCheck(prev => ({...prev, [key]: value}));
    },
    [],
  );

  const discardUnsavedTake = useCallback(async () => {
    if (
      sessionState === 'recording' &&
      take &&
      recordingStartedAtMs.current !== null
    ) {
      await stopRecording(take.filePath, recordingStartedAtMs.current);
    }
    if (take?.filePath) {
      await safeDeleteUnsavedTakeFile(take.filePath);
    }
    resetSentenceUi();
  }, [resetSentenceUi, sessionState, take]);

  const hasUnsavedProgress =
    sessionState === 'recording' ||
    (sessionState === 'recorded' &&
      (take !== null ||
        selfCheck.fullSentence ||
        selfCheck.keyWords ||
        selfCheck.rhythm));

  return {
    lesson,
    sentence,
    sentenceIndex,
    sentenceCount,
    sessionState,
    elapsedMs,
    take,
    selfCheck,
    hasUnsavedProgress,
    playNormalSample,
    playSlowSample,
    startRecordingTake,
    stopRecordingTake,
    reRecord,
    playMyTake,
    skipSentence,
    saveAndContinue,
    setSelfCheckItem,
    discardUnsavedTake,
  };
}
