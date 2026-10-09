import {readFileSync} from 'fs';
import {join} from 'path';
import React from 'react';
import {act} from 'react-test-renderer';

import {getAppConfig} from '@core/api/appConfig';
import {authenticatedFetch} from '@core/api/authenticatedFetch';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import type {EvaluationPayload} from '@core/schemas/evaluation';
import {UnitSummativeTaskResponseSchema} from '@core/schemas/lesson';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';
import {has, press, renderWithTheme, textOf} from '@test/support/lessonFlow';

import {SummativeTaskView} from '../SummativeTaskView';

jest.mock('@core/api/appConfig', () => ({getAppConfig: jest.fn()}));
jest.mock('@core/api/authenticatedFetch', () => ({
  authenticatedFetch: jest.fn(),
}));
jest.mock('@features/audio', () => ({speak: jest.fn()}));
jest.mock('@features/speaking', () => ({
  isEvaluationConsentOn: () => false,
  loadLessonRecorder: () => null,
  queueLessonTaskRecording: jest.fn(),
  setEvaluationConsent: jest.fn(),
  shouldAskEvaluationConsent: () => false,
}));

/** PR 16 (G5–G6): the unit's summative task, graded by the Server. */
const fixtureTask = UnitSummativeTaskResponseSchema.parse(
  JSON.parse(
    readFileSync(
      join(
        __dirname,
        '../../../../../core/schemas/__tests__/fixtures/valid-unit-summative-task-response.json',
      ),
      'utf8',
    ),
  ),
).task!;
const mockedFetch = authenticatedFetch as jest.Mock;

function evaluationFor(
  body: {attempt_id: string; substitute: boolean},
  outcome: EvaluationPayload['outcome'],
): EvaluationPayload {
  return {
    attempt_id: body.attempt_id,
    lesson_id: null,
    unit_id: fixtureTask.unit_id,
    block_id: null,
    task_id: fixtureTask.id,
    source: 'text',
    substitute: body.substitute,
    support_level: 'none',
    outcome,
    criteria: {
      purpose: {passed: true, score: null, required: true},
      content: {passed: true, score: 1, required: true},
      clarity: {passed: true, score: 1, required: true},
      independence: {passed: true, score: null, required: true},
    },
    errors: [],
    primary_issue: null,
    missing_words: [],
    reference_en: null,
    unscorable_reason: null,
    scorer_version: 1,
    evaluated_at: '2026-10-09T10:00:00.000Z',
  };
}

function answerWith(outcome: EvaluationPayload['outcome']) {
  mockedFetch.mockImplementation(async (url: string, init: RequestInit) => {
    if (String(url).endsWith('/v1/evaluations/text')) {
      const body = JSON.parse(String(init.body)) as {
        attempt_id: string;
        substitute: boolean;
        target: unknown;
      };
      expect(body.target).toEqual({
        unit_id: fixtureTask.unit_id,
        task_id: fixtureTask.id,
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          request_id: 'r',
          status: 'success',
          replayed: false,
          evaluation: evaluationFor(body, outcome),
        }),
      };
    }
    // Capabilities: speech is not graded for this learner.
    return {
      ok: true,
      status: 200,
      json: async () => ({
        request_id: 'r',
        status: 'success',
        evaluation: {text: true, speech: false},
      }),
    };
  });
}

async function typeAndSend(tree: ReturnType<typeof renderWithTheme>) {
  const field = tree.root.findAll(
    node =>
      node.props.testID === 'unit-summative-text' &&
      typeof node.props.onChangeText === 'function',
  )[0]!;
  act(() => {
    field.props.onChangeText('Can I have a large latte, please?');
  });
  await act(async () => {
    press(tree, 'unit-summative-send');
    await Promise.resolve();
  });
  await act(async () => {
    await new Promise(resolve => setImmediate(resolve));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (getAppConfig as jest.Mock).mockReturnValue({apiBaseUrl: 'https://api.test'});
  const db = openRealSqlite();
  resetDatabaseForTests(db);
  runMigrations(db);
});

afterEach(() => {
  resetDatabaseForTests(null);
});

it('grades a written task against the unit target and records no attempt', async () => {
  answerWith('pass_independent');
  const task = {...fixtureTask, response_mode: 'write' as const};
  const tree = renderWithTheme(<SummativeTaskView task={task} />);
  expect(has(tree, 'unit-summative-write-instead')).toBe(false);
  await typeAndSend(tree);

  expect(has(tree, 'lesson-flow-evaluation')).toBe(true);
  expect(has(tree, 'unit-summative-substitute-note')).toBe(false);
  const answers = getDatabase().execute(
    'SELECT unit_id, task_id, substitute, pending_text FROM task_answers;',
  ).rows?._array;
  expect(answers).toEqual([
    {
      unit_id: fixtureTask.unit_id,
      task_id: fixtureTask.id,
      substitute: 0,
      pending_text: null,
    },
  ]);
  expect(
    getDatabase().execute('SELECT COUNT(*) AS n FROM activity_attempts;').rows
      ?._array,
  ).toEqual([{n: 0}]);
});

it('writes a spoken task instead when speech is not graded, and says it does not pass the unit', async () => {
  answerWith('pass_independent');
  const tree = renderWithTheme(<SummativeTaskView task={fixtureTask} />);
  expect(textOf(tree, 'unit-summative-write-instead')).toContain(
    'chưa tính là đạt chương',
  );
  await typeAndSend(tree);
  expect(has(tree, 'unit-summative-substitute-note')).toBe(true);
  expect(
    getDatabase().execute('SELECT substitute FROM task_answers;').rows?._array,
  ).toEqual([{substitute: 1}]);
});

it('shows the last result when reopened', async () => {
  answerWith('fail');
  const task = {...fixtureTask, response_mode: 'write' as const};
  const first = renderWithTheme(<SummativeTaskView task={task} />);
  await typeAndSend(first);
  act(() => {
    first.unmount();
  });
  const again = renderWithTheme(<SummativeTaskView task={task} />);
  expect(has(again, 'lesson-flow-evaluation')).toBe(true);
});
