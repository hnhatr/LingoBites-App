import {useCallback, useEffect, useRef, useState} from 'react';

import {type LessonRecorder, loadLessonRecorder} from '@features/speaking';

import {createRequestId} from '@core/api/requestId';

export type SelfCheckRecorderState =
  | 'idle'
  | 'recording'
  | 'recorded'
  /** No recorder on this device, or the microphone was refused (G4). */
  | 'unavailable';

export type SelfCheckRecorder = {
  state: SelfCheckRecorderState;
  start: () => void;
  stop: () => void;
  play: () => void;
  /**
   * PR 14: hand the take over (to the upload queue). The file is then the
   * caller's and is not deleted when the controls go away; null without one.
   */
  release: () => {filePath: string; durationMs: number} | null;
};

export type SelfCheckRecorderOptions = {
  /** PR 14: record a step-5 answer for grading (task audio settings, H13). */
  forGrading?: boolean;
  /** Stop on its own after this long (45 s for step 5, decision A6). */
  maxMs?: number;
};

function safely(task: Promise<unknown>): void {
  task.catch(() => undefined);
}

/**
 * Record yourself and play it back next to the model sentence (decision G4).
 * The file is temporary: a new take replaces it and it is deleted when the
 * entry closes. It is never uploaded or saved as a speaking recording.
 */
export function useSelfCheckRecorder(
  recorder: LessonRecorder | null = loadLessonRecorder(),
  options: SelfCheckRecorderOptions = {},
): SelfCheckRecorder {
  const recorderRef = useRef(recorder);
  const [state, setState] = useState<SelfCheckRecorderState>(
    recorder ? 'idle' : 'unavailable',
  );
  const fileRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);
  const recordingRef = useRef(false);
  const durationRef = useRef(0);
  const limitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {forGrading = false, maxMs} = options;

  const clearLimit = useCallback(() => {
    if (limitRef.current) clearTimeout(limitRef.current);
    limitRef.current = null;
  }, []);

  const discard = useCallback(() => {
    const file = fileRef.current;
    fileRef.current = null;
    if (file && recorderRef.current) {
      safely(recorderRef.current.deleteRecordingFile(file));
    }
  }, []);

  useEffect(
    () => () => {
      clearLimit();
      const active = recorderRef.current;
      const file = fileRef.current;
      if (active && file && recordingRef.current) {
        // Leaving mid-take: stop the recorder before deleting its file.
        recordingRef.current = false;
        fileRef.current = null;
        safely(
          active
            .stopRecording(file, startedAtRef.current)
            .then(() => active.deleteRecordingFile(file)),
        );
        return;
      }
      if (active) {
        safely(active.stopPlayback());
      }
      discard();
    },
    [discard, clearLimit],
  );

  const stop = useCallback(() => {
    const active = recorderRef.current;
    const file = fileRef.current;
    clearLimit();
    if (!active || !file || !recordingRef.current) return;
    recordingRef.current = false;
    safely(
      active.stopRecording(file, startedAtRef.current).then(result => {
        if (result.ok) {
          fileRef.current = result.filePath;
          durationRef.current = result.durationMs;
          setState('recorded');
        } else {
          setState('idle');
        }
      }),
    );
  }, [clearLimit]);

  const start = useCallback(() => {
    const active = recorderRef.current;
    if (!active) return;
    discard();
    safely(
      active
        .startRecording(
          forGrading ? 'lesson_task' : 'shadowing',
          `lesson-${createRequestId()}`,
        )
        .then(result => {
          if (!result.ok) {
            setState('unavailable');
            return;
          }
          fileRef.current = result.filePath;
          startedAtRef.current = Date.now();
          recordingRef.current = true;
          setState('recording');
          if (maxMs) {
            limitRef.current = setTimeout(() => stop(), maxMs);
          }
        }),
    );
  }, [discard, forGrading, maxMs, stop]);

  const release = useCallback(() => {
    const file = fileRef.current;
    if (!file || recordingRef.current) return null;
    fileRef.current = null;
    setState('idle');
    return {filePath: file, durationMs: durationRef.current};
  }, []);

  const play = useCallback(() => {
    const active = recorderRef.current;
    const file = fileRef.current;
    if (active && file) {
      safely(active.playRecording(file));
    }
  }, []);

  return {state, start, stop, play, release};
}
