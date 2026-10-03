import {useFocusEffect} from '@react-navigation/native';
import {useCallback, useRef, useState} from 'react';

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
};

/**
 * Hub completion writer (LING-222 AD-004): one local `complete` tap through
 * `recordLessonEvent`, then a best-effort sync kick when the write succeeds.
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
    requestSync();
  }, [lessonId]);

  return {state, complete};
}
