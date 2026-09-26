/* eslint-disable react-hooks/exhaustive-deps */
import {useCallback, useMemo, useState} from 'react';
import {hasPendingPracticeSync} from '@shared/db/PracticeRepository';
import type {PracticeQuestion} from '@shared/schemas/practice';
import {gradeAnswer} from './grader';
import {
  answerCurrentQuestion,
  resumeSession,
  retrySession,
  summarizeSession,
  type SessionSnapshot,
} from './sessionEngine';

export type PendingFeedback = {
  question: PracticeQuestion;
  selectedOptionId: string;
  isCorrect: boolean;
};

export function usePracticeSessionScreen(sessionId: string) {
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(() =>
    resumeSession(sessionId),
  );
  const [pendingFeedback, setPendingFeedback] =
    useState<PendingFeedback | null>(null);

  const pendingSync = useMemo(
    () => hasPendingPracticeSync(sessionId),
    [sessionId, snapshot.events.length],
  );

  const resultSummary = useMemo(() => {
    if (!snapshot.isFinished) {
      return null;
    }
    return summarizeSession({sessionId});
  }, [sessionId, snapshot.isFinished, snapshot.session.updated_at]);

  const submitAnswer = useCallback(
    (optionId: string) => {
      if (pendingFeedback || snapshot.isFinished) {
        return;
      }
      const question = snapshot.currentQuestion;
      if (!question) {
        return;
      }
      const preview = gradeAnswer(question, optionId);
      const {session} = answerCurrentQuestion({
        sessionId,
        selectedOptionId: optionId,
      });
      setPendingFeedback({
        question,
        selectedOptionId: optionId,
        isCorrect: preview.isCorrect,
      });
      setSnapshot(resumeSession(session.id));
    },
    [pendingFeedback, sessionId, snapshot],
  );

  const continueAfterFeedback = useCallback(() => {
    setPendingFeedback(null);
  }, []);

  const restart = useCallback(() => {
    const next = retrySession({sessionId});
    setPendingFeedback(null);
    setSnapshot(resumeSession(next.id));
    return next.id;
  }, [sessionId]);

  return {
    snapshot,
    pendingFeedback,
    pendingSync,
    resultSummary,
    submitAnswer,
    continueAfterFeedback,
    restart,
  };
}

export type UsePracticeSessionScreen = ReturnType<
  typeof usePracticeSessionScreen
>;
