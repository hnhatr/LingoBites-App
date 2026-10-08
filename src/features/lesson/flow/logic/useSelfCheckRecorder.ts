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
): SelfCheckRecorder {
  const recorderRef = useRef(recorder);
  const [state, setState] = useState<SelfCheckRecorderState>(
    recorder ? 'idle' : 'unavailable',
  );
  const fileRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);
  const recordingRef = useRef(false);

  const discard = useCallback(() => {
    const file = fileRef.current;
    fileRef.current = null;
    if (file && recorderRef.current) {
      safely(recorderRef.current.deleteRecordingFile(file));
    }
  }, []);

  useEffect(
    () => () => {
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
    [discard],
  );

  const start = useCallback(() => {
    const active = recorderRef.current;
    if (!active) return;
    discard();
    safely(
      active
        .startRecording('shadowing', `lesson-${createRequestId()}`)
        .then(result => {
          if (!result.ok) {
            setState('unavailable');
            return;
          }
          fileRef.current = result.filePath;
          startedAtRef.current = Date.now();
          recordingRef.current = true;
          setState('recording');
        }),
    );
  }, [discard]);

  const stop = useCallback(() => {
    const active = recorderRef.current;
    const file = fileRef.current;
    if (!active || !file) return;
    recordingRef.current = false;
    safely(
      active.stopRecording(file, startedAtRef.current).then(result => {
        if (result.ok) {
          fileRef.current = result.filePath;
          setState('recorded');
        } else {
          setState('idle');
        }
      }),
    );
  }, []);

  const play = useCallback(() => {
    const active = recorderRef.current;
    const file = fileRef.current;
    if (active && file) {
      safely(active.playRecording(file));
    }
  }, []);

  return {state, start, stop, play};
}
