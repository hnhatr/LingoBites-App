import {PRACTICE_GRADER_VERSION} from '@shared/schemas/practice';
import type {PracticeQuestion} from '@shared/schemas/practice';

export const GRADER_VERSION = PRACTICE_GRADER_VERSION;

export type GradeOutcome = {
  isCorrect: boolean;
  /** False when the question cannot be graded (no resolvable correct option). */
  graded: boolean;
  graderVersion: string;
};

type GradableQuestion = {
  id?: string;
  options?: ReadonlyArray<{id: string; text: string}>;
  correct_option_id?: string;
};

/**
 * Pure offline grader (HI-4).
 *
 * Grades by `correct_option_id` only. Never compares option text, so
 * duplicate option texts cannot change the outcome. No I/O, no Date,
 * no Math.random, no network.
 */
export function gradeAnswer(
  question: GradableQuestion,
  selectedOptionId: string | null | undefined,
): GradeOutcome {
  const options = Array.isArray(question.options) ? question.options : [];
  const correctId =
    typeof question.correct_option_id === 'string'
      ? question.correct_option_id
      : undefined;
  const resolvable =
    correctId !== undefined && options.some(option => option.id === correctId);
  if (!resolvable || selectedOptionId == null) {
    return {isCorrect: false, graded: false, graderVersion: GRADER_VERSION};
  }
  return {
    isCorrect: selectedOptionId === correctId,
    graded: true,
    graderVersion: GRADER_VERSION,
  };
}

/** True when the question carries a resolvable `correct_option_id`. */
export function isGradable(question: GradableQuestion): boolean {
  const options = Array.isArray(question.options) ? question.options : [];
  return (
    typeof question.correct_option_id === 'string' &&
    options.some(option => option.id === question.correct_option_id)
  );
}

export type {PracticeQuestion};
