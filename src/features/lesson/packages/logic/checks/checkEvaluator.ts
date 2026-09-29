/**
 * Evaluator for Weekly and Stage Checks (REQ-40, REQ-41).
 *
 * Restricts check evaluation outcomes strictly to 'pass', 'conditional_pass',
 * or 'not_yet'.
 */

import type {CheckOutcome} from '../schema';

export type CheckEvaluationResult = {
  totalCount: number;
  correctCount: number;
  scorePercentage: number;
  outcome: CheckOutcome;
  feedbackVi: string;
};

export function evaluateCheckOutcome(scorePercentage: number): CheckOutcome {
  if (scorePercentage >= 80) {
    return 'pass';
  }
  if (scorePercentage >= 60) {
    return 'conditional_pass';
  }
  return 'not_yet';
}

export function evaluateCheck(
  answers: Array<{correct: boolean}>,
): CheckEvaluationResult {
  const totalCount = answers.length;
  if (totalCount === 0) {
    return {
      totalCount: 0,
      correctCount: 0,
      scorePercentage: 0,
      outcome: 'not_yet',
      feedbackVi: 'Chưa có câu trả lời nào được ghi nhận.',
    };
  }
  const correctCount = answers.filter(a => a.correct).length;
  const scorePercentage = Math.round((correctCount / totalCount) * 100);
  const outcome = evaluateCheckOutcome(scorePercentage);

  let feedbackVi = '';
  switch (outcome) {
    case 'pass':
      feedbackVi = 'Xuất sắc! Bạn đã đạt yêu cầu bài kiểm tra.';
      break;
    case 'conditional_pass':
      feedbackVi =
        'Đạt yêu cầu có điều kiện. Hãy ôn lại một số điểm kiến thức còn yếu.';
      break;
    case 'not_yet':
      feedbackVi =
        'Chưa đạt. Hãy thực hành lại bài học tiền đề trước khi thử lại.';
      break;
  }

  return {
    totalCount,
    correctCount,
    scorePercentage,
    outcome,
    feedbackVi,
  };
}
