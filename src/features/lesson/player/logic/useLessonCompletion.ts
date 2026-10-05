import {useFocusEffect} from '@react-navigation/native';
import {useCallback, useRef, useState} from 'react';

import {recordLessonCompletedActivity} from '@features/engagement';
import {requestSync} from '@features/sync';

import {getLessonProgress, recordLessonEvent} from '@core/sync/lessonProgress';

export type LessonCompletionState = 'unfinished' | 'finished' | 'error';

function readCompletionState(lessonId: string): LessonCompletionState {
  const progress = getLessonProgress(lessonId);
  return progress?.status === 'completed' ? 'finished' : 'unfinished';
}

export type UseLessonCompletionResult = {
  state: LessonCompletionState;
  complete: () => void;
  /** Records a `start` once for a never-started lesson (Home "Học tiếp"). */
  markStarted: () => void;
};

/**
 * Hub completion writer (LING-222 AD-004): one local `complete` tap through
 * `recordLessonEvent`, then a best-effort sync kick when the write succeeds.
 * A lesson that newly moves to completed also earns a streak day (F10).
 * `markStarted` writes the matching `start` the first time a lesson opens so
 * Home can offer "Học tiếp"; later opens queue nothing.
 */
export function useLessonCompletion(
  lessonId: string,
): UseLessonCompletionResult {
  const [state, setState] = useState<LessonCompletionState>(() =>
    readCompletionState(lessonId),
  );
  const guardRef = useRef(false);

  const refreshFromStore = useCallback(() => {
    const next = readCompletionState(lessonId);
    setState(previous => (previous === next ? previous : next));
    if (next === 'finished') {
      guardRef.current = true;
    }
  }, [lessonId]);

  useFocusEffect(
    useCallback(() => {
      refreshFromStore();
    }, [refreshFromStore]),
  );

  const complete = useCallback(() => {
    if (guardRef.current) {
      return;
    }
    guardRef.current = true;
    const result = recordLessonEvent({lessonId, event: 'complete'});
    if (!result.ok) {
      guardRef.current = false;
      setState('error');
      return;
    }
    setState('finished');
    if (result.advanced) {
      recordLessonCompletedActivity(lessonId);
    }
    requestSync();
  }, [lessonId]);

  const markStarted = useCallback(() => {
    if (getLessonProgress(lessonId)) {
      return;
    }
    const result = recordLessonEvent({lessonId, event: 'start'});
    if (result.ok) {
      requestSync();
    }
  }, [lessonId]);

  return {state, complete, markStarted};
}
