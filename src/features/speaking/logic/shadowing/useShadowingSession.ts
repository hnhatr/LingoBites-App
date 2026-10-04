import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
  const [take, setTake] = useState<ShadowingTake | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [selfCheck, setSelfCheck] =
    useState<ShadowingSelfCheck>(EMPTY_SELF_CHECK);

  const recordingStartedAtMs = useRef<number | null>(null);
  const autoStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const finishRecording = useCallback(
    async (filePath: string, startedAtMs: number) => {
      clearTimers();
      const stop = await stopRecording(filePath, startedAtMs);
      if (!stop.ok) {
        setSessionState('idle');
        recordingStartedAtMs.current = null;
        return;
      }
      setTake(prev =>
        prev
          ? {
              ...prev,
              filePath: stop.filePath,
              durationMs: stop.durationMs,
            }
          : null,
      );
      setElapsedMs(stop.durationMs);
      setSessionState('recorded');
      recordingStartedAtMs.current = null;
    },
    [clearTimers],
  );

  const beginRecordingInternal = useCallback(async () => {
    if (!sentence) {
      return;
    }
    const takeId = generateTakeId();
    const start = await startRecording('shadowing', takeId);
    if (!start.ok) {
      return;
    }
    const startedAt = Date.now();
    recordingStartedAtMs.current = startedAt;
    setTake({takeId, filePath: start.filePath, durationMs: 0});
    setSessionState('recording');
    setElapsedMs(0);

    tickTimer.current = setInterval(() => {
      const base = recordingStartedAtMs.current;
      if (base === null) {
        return;
      }
      setElapsedMs(Math.max(0, Date.now() - base));
    }, 250);

    autoStopTimer.current = setTimeout(() => {
      const path = start.filePath;
      const base = recordingStartedAtMs.current;
      if (base === null) {
        return;
      }
      finishRecording(path, base).catch(() => undefined);
    }, SHADOWING_MAX_RECORDING_MS);
  }, [finishRecording, generateTakeId, sentence]);

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
        sessionState !== 'recording' ||
        !take ||
        recordingStartedAtMs.current === null
      ) {
        return;
      }
      finishRecording(take.filePath, recordingStartedAtMs.current).catch(
        () => undefined,
      );
    };
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, [finishRecording, sessionState, take]);

  useEffect(() => () => clearTimers(), [clearTimers]);

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
    await safeDeleteUnsavedTakeFile(previousPath);
    await beginRecordingInternal();
  }, [beginRecordingInternal, clearTimers, sessionState, take]);

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
