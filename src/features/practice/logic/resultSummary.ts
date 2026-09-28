import {PRACTICE_CALCULATOR_VERSION} from '@shared/schemas/practice';
import type {
  AnswerEvent,
  PracticeQuestion,
  ResultSummary,
} from '@shared/schemas/practice';

export const CALCULATOR_VERSION = PRACTICE_CALCULATOR_VERSION;

export type BreakdownKey = 'vocabulary' | 'translation' | 'sentence';

function toBreakdownKey(skill: string): BreakdownKey | null {
  if (
    skill === 'vocabulary' ||
    skill === 'translation' ||
    skill === 'sentence'
  ) {
    return skill;
  }
  return null;
}

/**
 * Pure offline result calculator.
 *
 * - `score_percent` (accuracy) is computed over graded answers only —
 *   reveal-only / ungradable questions never dilute the score (fixes the
 *   `quizEngine.ts:88-93` defect that divided by every question).
 * - Breakdown counts correct answers per skill group.
 * - `review_candidates` aggregates wrong answers back to source IDs via
 *   each question's `source_refs`.
 *
 * No I/O, no Date, no network.
 */
export function calculateResultSummary(args: {
  sessionId: string;
  summaryId: string;
  questionOrder: readonly string[];
  questionsById: ReadonlyMap<string, PracticeQuestion>;
  events: readonly AnswerEvent[];
  calculatedAt: string;
}): ResultSummary {
  const {
    sessionId,
    summaryId,
    questionOrder,
    questionsById,
    events,
    calculatedAt,
  } = args;

  let gradedAnswered = 0;
  let correct = 0;
  const breakdown: {
    vocabulary?: number;
    translation?: number;
    sentence?: number;
  } = {};
  const wrongBySource = new Map<
    string,
    {
      source_kind: 'sentence' | 'vocabulary' | 'grammar';
      source_id: string;
      wrong_count: number;
    }
  >();

  for (const event of events) {
    if (event.session_id !== sessionId) {
      continue;
    }
    if (!isGradedEvent(event, questionsById)) {
      continue;
    }
    gradedAnswered += 1;
    if (event.is_correct) {
      correct += 1;
      const question = questionsById.get(event.question_id);
      const key = question ? toBreakdownKey(question.skill) : null;
      if (key) {
        breakdown[key] = (breakdown[key] ?? 0) + 1;
      }
    } else {
      const question = questionsById.get(event.question_id);
      for (const ref of question?.source_refs ?? []) {
        const mapKey = `${ref.kind}:${ref.id}`;
        const existing = wrongBySource.get(mapKey);
        if (existing) {
          existing.wrong_count += 1;
        } else {
          wrongBySource.set(mapKey, {
            source_kind: ref.kind,
            source_id: ref.id,
            wrong_count: 1,
          });
        }
      }
    }
  }

  const score_percent =
    gradedAnswered <= 0 ? 0 : Math.round((correct / gradedAnswered) * 100);

  return {
    id: summaryId,
    session_id: sessionId,
    total_questions: questionOrder.length,
    answered: events.filter(e => e.session_id === sessionId).length,
    correct,
    score_percent,
    breakdown,
    review_candidates: [...wrongBySource.values()],
    calculated_at: calculatedAt,
    calculator_version: CALCULATOR_VERSION,
  };
}

function isGradedEvent(
  event: AnswerEvent,
  questionsById: ReadonlyMap<string, PracticeQuestion>,
): boolean {
  const question = questionsById.get(event.question_id);
  if (!question) {
    // Unknown question: trust the stored grading flag. Events written by the
    // session engine always carry is_correct from the pure grader.
    return true;
  }
  const options = question.options ?? [];
  return options.some(option => option.id === question.correct_option_id);
}

/** Accuracy over graded answers only (shared with UI progress). */
export function accuracyOverGraded(
  correct: number,
  gradedAnswered: number,
): number {
  if (gradedAnswered <= 0) {
    return 0;
  }
  return Math.round((correct / gradedAnswered) * 100);
}
