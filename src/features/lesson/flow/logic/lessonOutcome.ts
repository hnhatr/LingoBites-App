import {useEffect, useState} from 'react';

import type {LessonSnapshot} from '@core/schemas/lesson';
import type {LessonActivityAttemptRow} from '@core/sync/activityAttempts';
import {
  getLessonOutcome,
  subscribeLearningOutcomes,
} from '@core/sync/learningOutcomes';
import {
  listTaskAnswersForLesson,
  subscribeTaskAnswers,
  type TaskAnswer,
} from '@core/sync/taskAnswers';

import {practiceCompleted} from './practiceCompletion';
import {answerExpired} from './taskEvaluation';

/**
 * PR 16 (decisions G2, G13): what step 6 says about the lesson. The
 * Server's `lesson_outcomes` row wins; without one (offline, not synced
 * yet) the device applies the same rule as PR 15: practice complete and
 * step 5 passed independently, by the scorer (not written instead of
 * spoken) or by a self- or rule-graded attempt.
 */
export type LessonOutcomeLabel =
  | 'passed'
  | 'awaiting_result'
  | 'practice_done'
  | 'in_progress';

export type LessonOutcomeView = {
  label: LessonOutcomeLabel;
  /** True when the label comes from the Server's row. */
  confirmed: boolean;
};

function scorerPassed(answers: readonly TaskAnswer[]): boolean {
  return answers.some(
    answer =>
      answer.evaluation?.outcome === 'pass_independent' &&
      !answer.evaluation.substitute,
  );
}

export function lessonOutcomeView(
  snapshot: LessonSnapshot,
  attempts: readonly LessonActivityAttemptRow[],
  now: number = Date.now(),
): LessonOutcomeView {
  const server = getLessonOutcome(snapshot.id);
  if (server?.passedAt) return {label: 'passed', confirmed: true};

  const practiceDone =
    practiceCompleted(snapshot, attempts) ||
    server?.practiceCompletedAt != null;
  if (!practiceDone) return {label: 'in_progress', confirmed: false};

  const answers = listTaskAnswersForLesson(snapshot.id);
  const selfPassed = attempts.some(
    attempt => attempt.step === 5 && attempt.outcome === 'pass_independent',
  );
  if (selfPassed || scorerPassed(answers)) {
    return {label: 'passed', confirmed: false};
  }
  const waiting = answers.some(
    answer => answer.evaluation === null && !answerExpired(answer, now),
  );
  return {
    label: waiting ? 'awaiting_result' : 'practice_done',
    confirmed: server != null,
  };
}

/** The step-6 view, kept current while results arrive (sync, polling). */
export function useLessonOutcome(
  snapshot: LessonSnapshot,
  attempts: readonly LessonActivityAttemptRow[],
): LessonOutcomeView {
  const [view, setView] = useState(() => lessonOutcomeView(snapshot, attempts));
  useEffect(() => {
    const refresh = () => setView(lessonOutcomeView(snapshot, attempts));
    refresh();
    const offOutcomes = subscribeLearningOutcomes(refresh);
    const offAnswers = subscribeTaskAnswers(refresh);
    return () => {
      offOutcomes();
      offAnswers();
    };
  }, [snapshot, attempts]);
  return view;
}
