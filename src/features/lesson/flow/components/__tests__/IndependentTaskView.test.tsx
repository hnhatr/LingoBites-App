import React from 'react';
import {act} from 'react-test-renderer';

import type {EvaluationPayload} from '@core/schemas/evaluation';
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
import * as grading from '../../logic/taskEvaluation';
import {IndependentTaskView} from '../IndependentTaskView';

jest.mock('@features/audio', () => ({
  speak: jest.fn(() => Promise.resolve({ok: true})),
}));
const mockRecorder = {
  startRecording: jest.fn(() =>
    Promise.resolve({ok: true, filePath: '/rec/answer.m4a'}),
  ),
  stopRecording: jest.fn(() =>
    Promise.resolve({ok: true, filePath: '/rec/answer.m4a', durationMs: 6200}),
  ),
  playRecording: jest.fn(() => Promise.resolve({ok: true})),
  stopPlayback: jest.fn(() => Promise.resolve()),
  deleteRecordingFile: jest.fn(() => Promise.resolve()),
};
let mockRecorderAvailable = false;
const mockSetEvaluationConsent = jest.fn();
jest.mock('@features/speaking', () => ({
  loadLessonRecorder: () => (mockRecorderAvailable ? mockRecorder : null),
  setEvaluationConsent: (...args: unknown[]) =>
    mockSetEvaluationConsent(...args),
  shouldAskEvaluationConsent: () => true,
}));
jest.mock('@core/sync/taskAnswers', () => ({
  latestTaskAnswerForBlock: () => null,
  subscribeTaskAnswers: () => () => undefined,
}));
jest.mock('../../logic/taskEvaluation', () => ({
  answerExpired: () => false,
  pollEvaluation: jest.fn(),
  refreshSpeechEvaluation: jest.fn(() => Promise.resolve(false)),
  speechEvaluationKnownEnabled: jest.fn(() => false),
  speechGradingReady: jest.fn(() => false),
  submitSpokenAnswer: jest.fn(),
  submitWrittenAnswer: jest.fn(),
}));

const mocked = grading as jest.Mocked<typeof grading>;

const snapshot = seedSnapshot();
const items = flowItems(snapshot);
const block = snapshot.blocks.find(
  candidate => candidate.type === 'activity' && candidate.step === 5,
)!;
const activity = flowActivity(block)!;
const independentTask = flowTask(snapshot, activity.taskId)!;

function evaluation(
  overrides: Partial<EvaluationPayload> = {},
): EvaluationPayload {
  const passed = {passed: true, score: 1, required: true};
  return {
    attempt_id: '99999999-9999-4999-8999-999999999911',
    lesson_id: snapshot.id,
    unit_id: null,
    block_id: block.id,
    task_id: independentTask.id,
    source: 'text',
    substitute: false,
    support_level: 'none',
    outcome: 'pass_independent',
    criteria: {
      purpose: passed,
      content: passed,
      clarity: passed,
      independence: {...passed, score: null},
    },
    errors: [],
    primary_issue: null,
    missing_words: [],
    reference_en: 'Can I have a large orange juice, please?',
    unscorable_reason: null,
    scorer_version: 1,
    evaluated_at: '2026-10-09T03:20:01.000Z',
    ...overrides,
  };
}

function render(
  task: LessonTask = independentTask,
  extra: {writeInstead?: boolean} = {},
) {
  const onFinished = jest.fn(() => true);
  const onPracticeRelated = jest.fn();
  const tree = renderWithTheme(
    <IndependentTaskView
      activity={activity}
      block={block}
      items={items}
      latestOutcome={null}
      onFinished={onFinished}
      onPracticeRelated={onPracticeRelated}
      snapshot={snapshot}
      task={task}
      writeInstead={extra.writeInstead}
    />,
  );
  return {tree, onFinished, onPracticeRelated};
}

function type(tree: ReturnType<typeof render>['tree'], text: string) {
  const input = byTestId(tree, 'lesson-flow-independent-text').find(
    node => typeof node.props.onChangeText === 'function',
  )!;
  act(() => {
    input.props.onChangeText(text);
  });
}

function button(tree: ReturnType<typeof render>['tree'], testID: string) {
  return byTestId(tree, testID).find(
    node => typeof node.props.onPress === 'function',
  )!;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRecorderAvailable = false;
  mocked.speechGradingReady.mockReturnValue(false);
  mocked.speechEvaluationKnownEnabled.mockReturnValue(false);
  mocked.refreshSpeechEvaluation.mockResolvedValue(false);
});

describe('IndependentTaskView (step 5): self-assessment', () => {
  it('shows the situation without models or hints', async () => {
    const {tree} = render();
    await flush();
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

  it('passes when every required criterion is ticked, then shows the reference', async () => {
    const {tree, onFinished} = render();
    await flush();
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
    expect(mocked.submitWrittenAnswer).not.toHaveBeenCalled();
  });

  it('fails when a required criterion is missing', async () => {
    const {tree, onFinished} = render();
    await flush();
    press(tree, 'lesson-flow-independent-done');
    press(tree, 'lesson-flow-criterion-purpose');
    press(tree, 'lesson-flow-criteria-save');
    expect(onFinished).toHaveBeenCalledWith('fail', 'none', expect.any(Number));
  });
});

describe('IndependentTaskView (step 5): graded by the Server (PR 14)', () => {
  it('sends a written answer and shows the pass', async () => {
    mocked.submitWrittenAnswer.mockResolvedValue({
      status: 'evaluated',
      evaluation: evaluation(),
    });
    const {tree, onFinished} = render({
      ...independentTask,
      response_mode: 'write',
    });
    expect(button(tree, 'lesson-flow-evaluation-send').props.disabled).toBe(
      true,
    );
    type(tree, '  Can I have a large orange juice, please? ');
    press(tree, 'lesson-flow-evaluation-send');
    await flush();

    const attemptId = (
      onFinished.mock.calls[0] as unknown as [
        string,
        string,
        number,
        {attemptId: string},
      ]
    )[3].attemptId;
    expect(onFinished).toHaveBeenCalledWith(
      'pending',
      'none',
      expect.any(Number),
      {
        attemptId,
      },
    );
    expect(mocked.submitWrittenAnswer).toHaveBeenCalledWith({
      attemptId,
      target: {lesson_id: snapshot.id, block_id: block.id},
      taskId: independentTask.id,
      text: 'Can I have a large orange juice, please?',
      substitute: false,
      supportLevel: 'none',
    });
    expect(textOf(tree, 'lesson-flow-evaluation-title')).toBe(
      'Bạn đã tự làm được!',
    );
    expect(has(tree, 'lesson-flow-criteria-save')).toBe(false);
  });

  it('keeps a written answer for later when offline', async () => {
    mocked.submitWrittenAnswer.mockResolvedValue({status: 'waiting'});
    const {tree} = render({...independentTask, response_mode: 'write'});
    type(tree, 'Can I have a sandwich, please?');
    press(tree, 'lesson-flow-evaluation-send');
    await flush();
    expect(textOf(tree, 'lesson-flow-evaluation-grading')).toBe(
      'Kết quả sẽ có khi có mạng.',
    );
  });

  it('records, sends and explains a failed spoken answer', async () => {
    mockRecorderAvailable = true;
    mocked.speechGradingReady.mockReturnValue(true);
    mocked.speechEvaluationKnownEnabled.mockReturnValue(true);
    mocked.refreshSpeechEvaluation.mockResolvedValue(true);
    mocked.pollEvaluation.mockResolvedValue(
      evaluation({
        source: 'speech',
        outcome: 'fail',
        criteria: {
          purpose: {passed: false, score: 0, required: true},
          content: {passed: false, score: 0.3, required: true},
          clarity: {passed: false, score: 0.25, required: true},
          independence: {passed: true, score: null, required: true},
        },
        primary_issue: {kind: 'criterion', criterion: 'purpose'},
        missing_words: ['large', 'orange', 'juice'],
      }),
    );
    const {tree, onFinished, onPracticeRelated} = render();
    await flush();
    expect(button(tree, 'lesson-flow-evaluation-send').props.disabled).toBe(
      true,
    );
    press(tree, 'lesson-flow-record');
    await flush();
    expect(mockRecorder.startRecording).toHaveBeenCalledWith(
      'lesson_task',
      expect.any(String),
    );
    press(tree, 'lesson-flow-stop-recording');
    await flush();
    press(tree, 'lesson-flow-evaluation-send');
    await flush();

    const graded = (
      onFinished.mock.calls[0] as unknown as [
        string,
        string,
        number,
        {attemptId: string; recordingClientId: string},
      ]
    )[3];
    expect(graded.recordingClientId).toEqual(expect.any(String));
    expect(mocked.submitSpokenAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptId: graded.attemptId,
        recordingId: graded.recordingClientId,
        filePath: '/rec/answer.m4a',
        durationMs: 6200,
      }),
    );
    // The take now belongs to the upload queue: it is not deleted here.
    expect(mockRecorder.deleteRecordingFile).not.toHaveBeenCalled();
    expect(textOf(tree, 'lesson-flow-evaluation-title')).toBe('Chưa đạt.');
    expect(textOf(tree, 'lesson-flow-evaluation-issue')).toBe(
      'Dùng đúng mẫu câu của bài',
    );
    expect(textOf(tree, 'lesson-flow-evaluation-missing')).toBe(
      'Còn thiếu: large, orange, juice',
    );
    press(tree, 'lesson-flow-evaluation-practice');
    expect(onPracticeRelated).toHaveBeenCalled();
    press(tree, 'lesson-flow-evaluation-retry');
    expect(has(tree, 'lesson-flow-evaluation-send')).toBe(true);
  });

  it('asks for consent first when the Server grades speech', async () => {
    mocked.speechEvaluationKnownEnabled.mockReturnValue(true);
    const {tree} = render();
    await flush();
    expect(has(tree, 'lesson-flow-evaluation-consent')).toBe(true);
    expect(has(tree, 'lesson-flow-independent-done')).toBe(false);
    press(tree, 'lesson-flow-evaluation-consent-agree');
    expect(mockSetEvaluationConsent).toHaveBeenCalledWith('on');
    expect(has(tree, 'lesson-flow-evaluation-send')).toBe(true);
  });

  it('declining the consent keeps self-assessment', async () => {
    mocked.speechEvaluationKnownEnabled.mockReturnValue(true);
    const {tree} = render();
    await flush();
    press(tree, 'lesson-flow-evaluation-consent-self');
    expect(mockSetEvaluationConsent).toHaveBeenCalledWith('off');
    expect(has(tree, 'lesson-flow-independent-done')).toBe(true);
  });

  it('writes instead of speaking when the learner cannot speak (A13)', async () => {
    mocked.submitWrittenAnswer.mockResolvedValue({
      status: 'evaluated',
      evaluation: evaluation({substitute: true}),
    });
    const {tree} = render(independentTask, {writeInstead: true});
    await flush();
    expect(has(tree, 'lesson-flow-write-instead')).toBe(true);
    type(tree, 'Can I have a large orange juice, please?');
    press(tree, 'lesson-flow-evaluation-send');
    await flush();
    expect(mocked.submitWrittenAnswer).toHaveBeenCalledWith(
      expect.objectContaining({substitute: true}),
    );
    expect(textOf(tree, 'lesson-flow-evaluation-title')).toBe(
      'Đạt (viết thay nói). Nói lại sau để tính đạt bài.',
    );
  });
});
