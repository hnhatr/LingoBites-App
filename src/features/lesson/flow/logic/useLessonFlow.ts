import {useCallback, useEffect, useMemo, useState} from 'react';

import {
  recordLessonActivityCompleted,
  recordLessonCompletedActivity,
} from '@features/engagement';
import {requestSync} from '@features/sync';

import {createRequestId} from '@core/api/requestId';
import type {LessonBlock, LessonSnapshot} from '@core/schemas/lesson';
import type {
  LessonAttemptOutcome,
  LessonSupportLevel,
} from '@core/schemas/sync';
import {
  type LessonActivityAttemptRow,
  listLessonActivityAttempts,
  recordLessonActivityAttempt,
} from '@core/sync/activityAttempts';
import {getLessonProgress, recordLessonEvent} from '@core/sync/lessonProgress';

import {blockItemKeys, flowActivity, flowItems} from './flowContent';
import {
  type FlowStep,
  practiceCompleted,
  remainingPracticeCount,
  resumeStep,
} from './practiceCompletion';

function readAttempts(lessonId: string): LessonActivityAttemptRow[] {
  try {
    return listLessonActivityAttempts(lessonId);
  } catch {
    return [];
  }
}

export type FinishedActivity = {
  block: LessonBlock;
  outcome: LessonAttemptOutcome;
  supportLevel: LessonSupportLevel;
  durationMs: number;
  /**
   * PR 14: an answer sent to the Server's scorer brings its own attempt id
   * (the answer row and the recording point at it) and is `service`-assessed.
   */
  graded?: {attemptId: string; recordingClientId?: string};
};

export type UseLessonFlowResult = {
  /** `null` until the snapshot is ready. */
  step: FlowStep | null;
  goTo: (step: FlowStep) => void;
  attempts: LessonActivityAttemptRow[];
  practiceDone: boolean;
  practiceRemaining: number;
  /** Records one finished activity block; false when it could not be saved. */
  finishActivity: (finished: FinishedActivity) => boolean;
};

/**
 * State of one run of the six-step player: the step on screen (opened where
 * the learner left off, decision G2), the lesson's attempts and the writer
 * for a finished activity (one attempt per block, decision G3).
 */
export function useLessonFlow(
  lessonId: string,
  snapshot: LessonSnapshot | null,
): UseLessonFlowResult {
  const [attempts, setAttempts] = useState<LessonActivityAttemptRow[]>(() =>
    readAttempts(lessonId),
  );
  const [step, setStep] = useState<FlowStep | null>(null);
  const sessionId = useMemo(() => createRequestId(), []);

  useEffect(() => {
    if (snapshot && step === null) {
      setStep(resumeStep(snapshot, attempts));
    }
  }, [snapshot, step, attempts]);

  const finishActivity = useCallback(
    ({block, outcome, supportLevel, durationMs, graded}: FinishedActivity) => {
      const activity = flowActivity(block);
      if (!snapshot || !activity || block.step == null) return false;
      const result = recordLessonActivityAttempt({
        activity: activity.kind,
        lessonId,
        blockId: block.id,
        contentRevision: snapshot.content_revision,
        step: block.step,
        taskId: activity.taskId,
        itemKeys: blockItemKeys(block, flowItems(snapshot)),
        sessionId,
        supportLevel,
        outcome,
        assessedBy: graded
          ? 'service'
          : SELF_ASSESSED.has(activity.kind)
          ? 'self'
          : 'rule',
        durationMs,
        ...(graded
          ? {id: graded.attemptId, recordingClientId: graded.recordingClientId}
          : {}),
      });
      if (!result.ok) return false;
      recordLessonActivityCompleted(result.id);
      const next = readAttempts(lessonId);
      setAttempts(next);
      if (practiceCompleted(snapshot, next)) {
        completeLessonOnce(lessonId);
      }
      requestSync();
      return true;
    },
    [lessonId, sessionId, snapshot],
  );

  return {
    step,
    goTo: setStep,
    attempts,
    practiceDone: snapshot ? practiceCompleted(snapshot, attempts) : false,
    practiceRemaining: snapshot
      ? remainingPracticeCount(snapshot, attempts)
      : 0,
    finishActivity,
  };
}

/**
 * Decision G6: the first time the practice part is done, the lesson moves to
 * completed (unit progress, Home and streak keep working as before). It is
 * written once; a lesson already completed is left as it is.
 */
function completeLessonOnce(lessonId: string): void {
  if (getLessonProgress(lessonId)?.status === 'completed') return;
  const result = recordLessonEvent({lessonId, event: 'complete'});
  if (result.ok && result.advanced) {
    recordLessonCompletedActivity(lessonId);
  }
}

/** Speaking activities are judged by the learner in Stage 2. */
const SELF_ASSESSED: ReadonlySet<string> = new Set([
  'listen_and_repeat',
  'speaking_drill',
  'role_play',
]);
