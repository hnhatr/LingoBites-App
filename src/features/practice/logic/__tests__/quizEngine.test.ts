import type {PracticeQuestion} from '../practiceQuestion';
import {
  accuracyPercent,
  correctOptionIndex,
  goNext,
  hasInvalidMetaOptions,
  initialQuizState,
  isMultipleChoice,
  restartQuiz,
  revealAnswer,
  selectAnswer,
} from '../quizEngine';

const mc = (
  id: string,
  answer: string,
  options: string[],
): PracticeQuestion => ({
  id,
  type: 'multiple_choice',
  question: `q-${id}`,
  options,
  answer,
});

const translation = (id: string, answer: string): PracticeQuestion => ({
  id,
  type: 'translation',
  question: `q-${id}`,
  answer,
});

describe('quizEngine', () => {
  describe('helpers', () => {
    it('detects multiple choice with options', () => {
      expect(isMultipleChoice(mc('1', 'a', ['a', 'b']))).toBe(true);
      expect(isMultipleChoice(translation('1', 'a'))).toBe(false);
    });

    it('finds the index of the correct option', () => {
      expect(correctOptionIndex(mc('1', 'b', ['a', 'b', 'c']))).toBe(1);
      expect(correctOptionIndex(mc('1', 'zzz', ['a', 'b']))).toBe(-1);
    });

    it('flags meta-label options as invalid (SETE-210 P0)', () => {
      expect(
        hasInvalidMetaOptions(
          mc('bad', 'từ vựng: English', [
            'từ vựng: English',
            'việc học tập',
            'việc nói',
            'từ vựng: easy',
          ]),
        ),
      ).toBe(true);
      expect(
        hasInvalidMetaOptions(
          mc('bad2', 'x', ['ngữ pháp: hiện tại', 'việc học tập']),
        ),
      ).toBe(true);
    });

    it('accepts plain Vietnamese meanings', () => {
      expect(
        hasInvalidMetaOptions(
          mc('good', 'việc học tập', ['việc học tập', 'việc nói', 'quả táo']),
        ),
      ).toBe(false);
      expect(hasInvalidMetaOptions(translation('t1', 'a'))).toBe(false);
    });
  });

  describe('selectAnswer', () => {
    it('marks a correct answer and increments score', () => {
      const q = mc('1', 'b', ['a', 'b', 'c']);
      const next = selectAnswer(initialQuizState, q, 1);
      expect(next.status).toBe('answered');
      expect(next.isCorrect).toBe(true);
      expect(next.selectedIndex).toBe(1);
      expect(next.score).toBe(1);
      expect(next.answeredCount).toBe(1);
    });

    it('marks a wrong answer without incrementing score', () => {
      const q = mc('1', 'b', ['a', 'b', 'c']);
      const next = selectAnswer(initialQuizState, q, 0);
      expect(next.isCorrect).toBe(false);
      expect(next.score).toBe(0);
      expect(next.answeredCount).toBe(1);
    });

    it('ignores a second answer once answered', () => {
      const q = mc('1', 'b', ['a', 'b', 'c']);
      const answered = selectAnswer(initialQuizState, q, 1);
      const again = selectAnswer(answered, q, 0);
      expect(again).toEqual(answered);
    });
  });

  describe('revealAnswer', () => {
    it('marks a non-MC question answered without scoring', () => {
      const next = revealAnswer(initialQuizState);
      expect(next.status).toBe('answered');
      expect(next.isCorrect).toBeNull();
      expect(next.score).toBe(0);
      expect(next.answeredCount).toBe(1);
    });
  });

  describe('goNext', () => {
    it('advances to the next question and resets answer state', () => {
      const q = mc('1', 'b', ['a', 'b']);
      const answered = selectAnswer(initialQuizState, q, 1);
      const next = goNext(answered, 3);
      expect(next.index).toBe(1);
      expect(next.status).toBe('answering');
      expect(next.selectedIndex).toBeNull();
      expect(next.isCorrect).toBeNull();
      expect(next.score).toBe(1); // score is retained
    });

    it('finishes after the last question', () => {
      const q = mc('1', 'b', ['a', 'b']);
      let state = selectAnswer(initialQuizState, q, 1);
      state = goNext(state, 2); // -> index 1
      state = selectAnswer(state, q, 0); // wrong
      state = goNext(state, 2); // last -> finished
      expect(state.status).toBe('finished');
      expect(state.index).toBe(1);
      expect(state.score).toBe(1);
    });
  });

  describe('accuracyPercent', () => {
    it('returns rounded percentage of correct answers', () => {
      expect(accuracyPercent({...initialQuizState, score: 2}, 3)).toBe(67);
      expect(accuracyPercent({...initialQuizState, score: 0}, 0)).toBe(0);
    });
  });

  describe('restartQuiz', () => {
    it('returns a fresh initial state', () => {
      expect(restartQuiz()).toEqual(initialQuizState);
    });
  });
});
