import {useCallback, useMemo, useState} from 'react';
import type {PracticeQuestion} from './practiceQuestion';
import {
  accuracyPercent,
  correctOptionIndex,
  goNext,
  initialQuizState,
  isMultipleChoice,
  restartQuiz,
  revealAnswer,
  selectAnswer,
  type QuizState,
} from './quizEngine';

export type UseQuiz = {
  state: QuizState;
  current: PracticeQuestion | undefined;
  total: number;
  isLast: boolean;
  isMultipleChoice: boolean;
  correctIndex: number;
  accuracy: number;
  select: (optionIndex: number) => void;
  reveal: () => void;
  next: () => void;
  restart: () => void;
};

export function useQuiz(questions: PracticeQuestion[]): UseQuiz {
  const [state, setState] = useState<QuizState>(initialQuizState);
  const total = questions.length;
  const current = questions[state.index];

  const select = useCallback(
    (optionIndex: number) => {
      if (!current) {
        return;
      }
      setState(prev => selectAnswer(prev, current, optionIndex));
    },
    [current],
  );

  const reveal = useCallback(() => {
    setState(prev => revealAnswer(prev));
  }, []);

  const next = useCallback(() => {
    setState(prev => goNext(prev, total));
  }, [total]);

  const restart = useCallback(() => {
    setState(restartQuiz());
  }, []);

  return useMemo(
    () => ({
      state,
      current,
      total,
      isLast: state.index >= total - 1,
      isMultipleChoice: current ? isMultipleChoice(current) : false,
      correctIndex: current ? correctOptionIndex(current) : -1,
      accuracy: accuracyPercent(state, total),
      select,
      reveal,
      next,
      restart,
    }),
    [state, current, total, select, reveal, next, restart],
  );
}
