import React from 'react';
import {act} from 'react-test-renderer';

import type {LessonBlock} from '@core/schemas/lesson';

import {
  has,
  press,
  renderWithTheme,
  seedSnapshot,
  textOf,
} from '@test/support/lessonFlow';

import {flowActivity, flowItems, flowTask} from '../../logic/flowContent';
import {ActivityRunner} from '../ActivityRunner';

const mockSpeak = jest.fn((_text: string) => Promise.resolve({ok: true}));
jest.mock('@features/audio', () => ({
  speak: (text: string) => mockSpeak(text),
}));

const mockRecorder = {
  startRecording: jest.fn(() =>
    Promise.resolve({ok: true, filePath: '/tmp/take.m4a'}),
  ),
  stopRecording: jest.fn(() =>
    Promise.resolve({ok: true, filePath: '/tmp/take.m4a', durationMs: 900}),
  ),
  playRecording: jest.fn(() => Promise.resolve({ok: true})),
  stopPlayback: jest.fn(() => Promise.resolve()),
  deleteRecordingFile: jest.fn(() => Promise.resolve()),
};
let mockRecorderAvailable = true;
jest.mock('@features/speaking', () => ({
  loadLessonRecorder: () => (mockRecorderAvailable ? mockRecorder : null),
}));

const snapshot = seedSnapshot();
const items = flowItems(snapshot);
const blockOn = (step: number) =>
  snapshot.blocks.find(
    block => block.type === 'activity' && block.step === step,
  )!;

function run(block: LessonBlock) {
  const onFinished = jest.fn(() => true);
  const tree = renderWithTheme(
    <ActivityRunner
      activity={flowActivity(block)!}
      block={block}
      items={items}
      latestOutcome={null}
      task={flowTask(snapshot, flowActivity(block)!.taskId)}
      onFinished={onFinished}
    />,
  );
  return {tree, onFinished};
}

const flush = () =>
  act(async () => {
    await Promise.resolve();
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockRecorderAvailable = true;
});

describe('speaking activities (self-check)', () => {
  it('listen and repeat: all "Đạt" passes independently, one "Chưa đạt" fails', () => {
    const block = blockOn(3);
    const first = run(block);
    for (let i = 0; i < 3; i += 1) {
      press(first.tree, 'lesson-flow-self-pass');
      press(first.tree, 'lesson-flow-entry-next');
    }
    expect(first.onFinished).toHaveBeenCalledWith(
      'pass_independent',
      'none',
      expect.any(Number),
    );

    const second = run(block);
    press(second.tree, 'lesson-flow-self-pass');
    press(second.tree, 'lesson-flow-entry-next');
    press(second.tree, 'lesson-flow-self-fail');
    press(second.tree, 'lesson-flow-entry-next');
    press(second.tree, 'lesson-flow-self-pass');
    press(second.tree, 'lesson-flow-entry-next');
    expect(second.onFinished).toHaveBeenCalledWith(
      'fail',
      'none',
      expect.any(Number),
    );
  });

  it('records a local take, plays it back and deletes it afterwards', async () => {
    const {tree} = run(blockOn(3));
    expect(textOf(tree, 'lesson-flow-model-sentence')).toBe(
      'Can I have a small coffee, please?',
    );
    press(tree, 'lesson-flow-record');
    await flush();
    expect(mockRecorder.startRecording).toHaveBeenCalledWith(
      'shadowing',
      expect.stringMatching(/^lesson-/),
    );
    press(tree, 'lesson-flow-stop-recording');
    await flush();
    press(tree, 'lesson-flow-play-recording');
    expect(mockRecorder.playRecording).toHaveBeenCalledWith('/tmp/take.m4a');

    act(() => {
      tree.unmount();
    });
    expect(mockRecorder.deleteRecordingFile).toHaveBeenCalledWith(
      '/tmp/take.m4a',
    );
  });

  it('still lets the learner judge without a recorder', () => {
    mockRecorderAvailable = false;
    const {tree} = run(blockOn(3));
    expect(has(tree, 'lesson-flow-recorder-unavailable')).toBe(true);
    expect(has(tree, 'lesson-flow-record')).toBe(false);
    press(tree, 'lesson-flow-self-pass');
    expect(has(tree, 'lesson-flow-entry-next')).toBe(true);
  });

  it("speaking drill: the guided task's hints open one by one and count as support", () => {
    const {tree, onFinished} = run(blockOn(4));
    expect(has(tree, 'lesson-flow-model-sentence')).toBe(false);
    expect(has(tree, 'lesson-flow-listen-model')).toBe(false);
    press(tree, 'lesson-flow-hint');
    expect(textOf(tree, 'lesson-flow-hint-1')).toContain('Nghe lại câu mẫu.');
    expect(mockSpeak).toHaveBeenCalledWith(
      'Can I have a small coffee, please?',
    );
    press(tree, 'lesson-flow-hint');
    press(tree, 'lesson-flow-hint');
    expect(textOf(tree, 'lesson-flow-hint-3')).toContain(
      'Can I have a small coffee, please?',
    );
    expect(has(tree, 'lesson-flow-hint')).toBe(false);
    press(tree, 'lesson-flow-self-pass');
    press(tree, 'lesson-flow-entry-next');
    for (let i = 0; i < 3; i += 1) {
      press(tree, 'lesson-flow-self-pass');
      press(tree, 'lesson-flow-entry-next');
    }
    expect(onFinished).toHaveBeenCalledWith(
      'pass_with_support',
      'model',
      expect.any(Number),
    );
  });

  it('role play: shows the other speaker, then the learner turn', () => {
    const {tree, onFinished} = run(blockOn(5));
    expect(has(tree, 'lesson-flow-partner-line')).toBe(true);
    expect(textOf(tree, 'lesson-flow-prompt')).toBe(
      'Lượt của bạn (A): Cho tôi một nước cam cỡ lớn được không?',
    );
    press(tree, 'lesson-flow-self-pass');
    press(tree, 'lesson-flow-entry-next');
    expect(onFinished).toHaveBeenCalledWith(
      'pass_independent',
      'none',
      expect.any(Number),
    );
  });
});
