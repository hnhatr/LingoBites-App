import React from 'react';

import type {EvaluationPayload} from '@core/schemas/evaluation';

import {
  byTestId,
  has,
  press,
  renderWithTheme,
  textOf,
} from '@test/support/lessonFlow';

import {EvaluationFeedback} from '../EvaluationFeedback';

/** PR 14 (decision H9): the scorer's result in four states. */
const met = {passed: true, score: 1, required: true};
const base: EvaluationPayload = {
  attempt_id: '99999999-9999-4999-8999-999999999911',
  lesson_id: '33333333-3333-4333-8333-333333333303',
  unit_id: null,
  block_id: '44444444-4444-4444-8444-444444444415',
  task_id: '66666666-6666-4666-8666-666666666603',
  source: 'speech',
  substitute: false,
  support_level: 'none',
  outcome: 'pass_independent',
  criteria: {
    purpose: met,
    content: met,
    clarity: met,
    independence: {...met, score: null},
  },
  errors: [],
  primary_issue: null,
  missing_words: [],
  reference_en: 'Can I have a sandwich, please?',
  unscorable_reason: null,
  scorer_version: 1,
  evaluated_at: '2026-10-09T03:20:01.000Z',
};

function render(evaluation: EvaluationPayload) {
  const onRetry = jest.fn();
  const onPracticeRelated = jest.fn();
  const tree = renderWithTheme(
    <EvaluationFeedback
      evaluation={evaluation}
      onPracticeRelated={onPracticeRelated}
      onRetry={onRetry}
    />,
  );
  return {tree, onRetry, onPracticeRelated};
}

it('a pass lists the criteria met and offers no retry', () => {
  const {tree} = render(base);
  expect(textOf(tree, 'lesson-flow-evaluation-title')).toBe(
    'Bạn đã tự làm được!',
  );
  expect(textOf(tree, 'lesson-flow-evaluation-met')).toContain(
    'Tự làm, không dùng gợi ý',
  );
  expect(has(tree, 'lesson-flow-evaluation-retry')).toBe(false);
});

it('a pass with hints offers a retry without hints', () => {
  const {tree, onRetry} = render({
    ...base,
    outcome: 'pass_with_support',
    support_level: 'hint_1',
    criteria: {
      ...base.criteria,
      independence: {passed: false, score: null, required: true},
    },
  });
  expect(textOf(tree, 'lesson-flow-evaluation-title')).toBe(
    'Đạt, nhưng còn cần gợi ý.',
  );
  const retry = byTestId(tree, 'lesson-flow-evaluation-retry').find(
    node => typeof node.props.onPress === 'function',
  )!;
  expect(retry.props.title).toBe('Thử lại không gợi ý');
  press(tree, 'lesson-flow-evaluation-retry');
  expect(onRetry).toHaveBeenCalled();
});

it('a fail names the blocking error, the missing words and the reference', () => {
  const {tree, onPracticeRelated} = render({
    ...base,
    outcome: 'fail',
    errors: [
      {
        item_code: 'pattern:can-i-have',
        code: 'missing_drink',
        severity: 'blocking',
        feedback_vi: 'Nói rõ bạn muốn uống gì.',
      },
    ],
    primary_issue: {kind: 'error', code: 'missing_drink'},
    missing_words: ['coffee'],
  });
  expect(textOf(tree, 'lesson-flow-evaluation-issue')).toBe(
    'Nói rõ bạn muốn uống gì.',
  );
  expect(textOf(tree, 'lesson-flow-evaluation-missing')).toBe(
    'Còn thiếu: coffee',
  );
  expect(textOf(tree, 'lesson-flow-evaluation-reference')).toBe(
    'Câu tham khảo: Can I have a sandwich, please?',
  );
  press(tree, 'lesson-flow-evaluation-practice');
  expect(onPracticeRelated).toHaveBeenCalled();
});

it('could not grade is never a failure and says why', () => {
  const {tree} = render({
    ...base,
    outcome: 'unscorable',
    unscorable_reason: 'limit',
    reference_en: null,
  });
  expect(textOf(tree, 'lesson-flow-evaluation-title')).toBe(
    'Chưa nghe rõ, thử lại nhé.',
  );
  expect(textOf(tree, 'lesson-flow-evaluation-reason')).toContain(
    'Hôm nay đã hết lượt chấm',
  );
  expect(has(tree, 'lesson-flow-evaluation-practice')).toBe(false);
});

it('a written-instead pass says it does not pass the lesson yet', () => {
  const {tree} = render({...base, source: 'text', substitute: true});
  expect(textOf(tree, 'lesson-flow-evaluation-title')).toBe(
    'Đạt (viết thay nói). Nói lại sau để tính đạt bài.',
  );
});
