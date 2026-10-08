import React from 'react';
import {act} from 'react-test-renderer';

import type {LessonBlock} from '@core/schemas/lesson';

import {
  byTestId,
  has,
  press,
  renderWithTheme,
  seedSnapshot,
  textOf,
} from '@test/support/lessonFlow';

import {flowActivity, flowItems} from '../../logic/flowContent';
import {ActivityRunner} from '../ActivityRunner';

const snapshot = seedSnapshot();
const items = flowItems(snapshot);
const pattern = snapshot.lesson_items!.find(
  entry => entry.item.kind === 'pattern',
)!.item;

function activityBlock(data: Record<string, unknown>): LessonBlock {
  return {
    id: '77777777-7777-4777-8777-777777777701',
    type: 'activity',
    position: 9,
    title: null,
    step: 4,
    skill: 'write',
    duration_sec: 60,
    data: {titleVi: 'Luyện', ...data},
  };
}

function run(block: LessonBlock) {
  const onFinished = jest.fn(() => true);
  const tree = renderWithTheme(
    <ActivityRunner
      activity={flowActivity(block)!}
      block={block}
      items={items}
      latestOutcome={null}
      onFinished={onFinished}
    />,
  );
  return {tree, onFinished};
}

function type(tree: ReturnType<typeof renderWithTheme>, text: string) {
  const input = byTestId(tree, 'lesson-flow-answer-input').find(
    node => typeof node.props.onChangeText === 'function',
  )!;
  act(() => {
    input.props.onChangeText(text);
  });
  press(tree, 'lesson-flow-check');
}

const next = (tree: ReturnType<typeof renderWithTheme>) =>
  press(tree, 'lesson-flow-entry-next');

describe('rule-graded activities', () => {
  const choice = activityBlock({
    activityKind: 'multiple_choice',
    content: {
      questions: [
        {
          id: 'q1',
          promptVi: 'Câu nào lịch sự?',
          options: [
            {id: 'o1', text: 'I want tea.'},
            {id: 'o2', text: 'Can I have a tea, please?'},
          ],
          correctOptionId: 'o2',
        },
        {
          id: 'q2',
          promptVi: 'Chọn "trà"',
          options: [
            {id: 'o1', text: 'tea'},
            {id: 'o2', text: 'milk'},
          ],
          correctOptionId: 'o1',
        },
      ],
    },
  });

  it('multiple choice: a wrong pick then the right one passes with support', () => {
    const {tree, onFinished} = run(choice);
    expect(textOf(tree, 'lesson-flow-entry-count')).toBe('Câu 1/2');
    press(tree, 'lesson-flow-option-0');
    expect(has(tree, 'lesson-flow-feedback-wrong')).toBe(true);
    expect(has(tree, 'lesson-flow-entry-next')).toBe(false);
    press(tree, 'lesson-flow-option-1');
    next(tree);
    press(tree, 'lesson-flow-option-0');
    next(tree);
    expect(onFinished).toHaveBeenCalledWith(
      'pass_with_support',
      expect.any(Number),
    );
    expect(has(tree, 'lesson-flow-activity-redo')).toBe(true);
  });

  it('multiple choice: every first pick right passes independently', () => {
    const {tree, onFinished} = run(choice);
    press(tree, 'lesson-flow-option-1');
    next(tree);
    press(tree, 'lesson-flow-option-0');
    next(tree);
    expect(onFinished).toHaveBeenCalledWith(
      'pass_independent',
      expect.any(Number),
    );
  });

  it('fill blank: choices, typing and "show the answer"', () => {
    const {tree, onFinished} = run(
      activityBlock({
        activityKind: 'fill_blank',
        content: {
          questions: [
            {
              id: 'q1',
              beforeEn: 'Can I have a ',
              afterEn: ' coffee?',
              answer: 'small',
              options: ['small', 'tall'],
              textVi: 'cỡ nhỏ',
            },
            {
              id: 'q2',
              beforeEn: 'Can I have a large ',
              afterEn: ', please?',
              answer: 'tea',
              textVi: 'trà',
            },
            {
              id: 'q3',
              beforeEn: '',
              afterEn: ' please?',
              answer: 'Coffee',
              textVi: 'cà phê',
            },
          ],
        },
      }),
    );
    expect(textOf(tree, 'lesson-flow-prompt')).toBe(
      'Can I have a _____ coffee?',
    );
    press(tree, 'lesson-flow-option-0');
    next(tree);
    type(tree, ' TEA ');
    expect(has(tree, 'lesson-flow-feedback-right')).toBe(true);
    next(tree);
    press(tree, 'lesson-flow-show-answer');
    expect(textOf(tree, 'lesson-flow-model-answer')).toBe('Câu mẫu: Coffee');
    next(tree);
    expect(onFinished).toHaveBeenCalledWith('fail', expect.any(Number));
  });

  it('translation: accepts a variant of the pattern, a wrong answer can be fixed', () => {
    const {tree, onFinished} = run(
      activityBlock({
        activityKind: 'translation',
        content: {
          sentences: [
            {
              id: 's1',
              textVi: 'Cho tôi một trà cỡ lớn.',
              modelEn: 'Can I have a large tea, please?',
              patternItemId: pattern.id,
            },
            {id: 's2', textVi: 'Cảm ơn.', modelEn: 'Thank you.'},
          ],
        },
      }),
    );
    type(tree, "I'd like a large tea, please");
    expect(has(tree, 'lesson-flow-feedback-right')).toBe(true);
    next(tree);
    type(tree, 'Thanks a lot');
    expect(has(tree, 'lesson-flow-feedback-wrong')).toBe(true);
    type(tree, 'thank you');
    next(tree);
    expect(onFinished).toHaveBeenCalledWith(
      'pass_with_support',
      expect.any(Number),
    );
  });

  it('says when an activity has no valid content', () => {
    const {tree} = run(
      activityBlock({activityKind: 'translation', content: {prompts: []}}),
    );
    expect(has(tree, 'lesson-flow-activity-empty')).toBe(true);
  });
});
