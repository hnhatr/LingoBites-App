import React from 'react';
import {act} from 'react-test-renderer';

import type {LessonTask} from '@core/schemas/lesson';

import {
  byTestId,
  has,
  press,
  renderWithTheme,
  seedSnapshot,
  textOf,
} from '@test/support/lessonFlow';

import {flowActivity, flowItems, flowTask} from '../../logic/flowContent';
import {IndependentTaskView} from '../IndependentTaskView';

jest.mock('@features/audio', () => ({
  speak: jest.fn(() => Promise.resolve({ok: true})),
}));
jest.mock('@features/speaking', () => ({loadLessonRecorder: () => null}));

const snapshot = seedSnapshot();
const items = flowItems(snapshot);
const block = snapshot.blocks.find(
  candidate => candidate.type === 'activity' && candidate.step === 5,
)!;
const activity = flowActivity(block)!;
const independentTask = flowTask(snapshot, activity.taskId)!;

function render(task: LessonTask = independentTask) {
  const onFinished = jest.fn(() => true);
  const tree = renderWithTheme(
    <IndependentTaskView
      activity={activity}
      block={block}
      items={items}
      latestOutcome={null}
      onFinished={onFinished}
      snapshot={snapshot}
      task={task}
    />,
  );
  return {tree, onFinished};
}

describe('IndependentTaskView (step 5)', () => {
  it('shows the situation without models or hints', () => {
    const {tree} = render();
    expect(textOf(tree, 'lesson-flow-situation')).toContain(
      'Mục đích: gọi nước cam cỡ lớn',
    );
    expect(has(tree, 'lesson-flow-hint')).toBe(false);
    expect(has(tree, 'lesson-flow-model-sentence')).toBe(false);
    expect(has(tree, 'lesson-flow-partner-line')).toBe(true);
    expect(has(tree, 'lesson-flow-independent-your-turn')).toBe(true);
    // The learner's line is nowhere on screen.
    expect(JSON.stringify(tree.toJSON())).not.toContain(
      'Can I have a large orange juice',
    );
  });

  it('passes when every required criterion is ticked, then shows the reference', () => {
    const {tree, onFinished} = render();
    press(tree, 'lesson-flow-independent-done');
    for (const criterion of ['purpose', 'content', 'clarity', 'independence']) {
      press(tree, `lesson-flow-criterion-${criterion}`);
    }
    press(tree, 'lesson-flow-criteria-save');
    expect(onFinished).toHaveBeenCalledWith(
      'pass_independent',
      'none',
      expect.any(Number),
    );
    expect(textOf(tree, 'lesson-flow-activity-outcome')).toBe(
      'Đạt, tự làm được',
    );
    press(tree, 'lesson-flow-show-reference');
    expect(textOf(tree, 'lesson-flow-reference')).toContain(
      'Can I have a large orange juice, please?',
    );
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('fails when a required criterion is missing', () => {
    const {tree, onFinished} = render();
    press(tree, 'lesson-flow-independent-done');
    press(tree, 'lesson-flow-criterion-purpose');
    press(tree, 'lesson-flow-criteria-save');
    expect(onFinished).toHaveBeenCalledWith('fail', 'none', expect.any(Number));
  });

  it('asks for a written answer when the task is written', () => {
    const {tree} = render({...independentTask, response_mode: 'write'});
    const done = byTestId(tree, 'lesson-flow-independent-done').find(
      node => typeof node.props.onPress === 'function',
    )!;
    expect(done.props.disabled).toBe(true);
    const input = byTestId(tree, 'lesson-flow-independent-text').find(
      node => typeof node.props.onChangeText === 'function',
    )!;
    act(() => {
      input.props.onChangeText('Can I have a large orange juice?');
    });
    press(tree, 'lesson-flow-independent-done');
    expect(has(tree, 'lesson-flow-criterion-purpose')).toBe(true);
  });
});
