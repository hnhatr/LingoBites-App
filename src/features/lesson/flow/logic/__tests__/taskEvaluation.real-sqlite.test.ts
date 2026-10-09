import {readFileSync} from 'fs';
import {join} from 'path';

import {getAppConfig} from '@core/api/appConfig';
import {authenticatedFetch} from '@core/api/authenticatedFetch';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import type {EvaluationPayload} from '@core/schemas/evaluation';
import {getTaskAnswer, saveEvaluation} from '@core/sync/taskAnswers';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {
  ANSWER_EXPIRY_MS,
  answerExpired,
  pollEvaluation,
  refreshSpeechEvaluation,
  sendWaitingWrittenAnswers,
  speechEvaluationKnownEnabled,
  speechGradingReady,
  submitWrittenAnswer,
} from '../taskEvaluation';

jest.mock('@core/api/appConfig', () => ({getAppConfig: jest.fn()}));
jest.mock('@core/api/authenticatedFetch', () => ({
  authenticatedFetch: jest.fn(),
}));
let mockConsentOn = false;
jest.mock('@features/speaking', () => ({
  isEvaluationConsentOn: () => mockConsentOn,
  queueLessonTaskRecording: jest.fn(),
}));

/** PR 14: sending step-5 answers to the Server's scorer and waiting for it. */
const mockedFetch = authenticatedFetch as jest.Mock;

const pull = JSON.parse(
  readFileSync(
    join(
      __dirname,
      '../../../../../core/schemas/__tests__/fixtures/valid-sync-evaluation-pull-response.json',
    ),
    'utf8',
  ),
) as {records: Array<{payload: EvaluationPayload}>};
const pass = pull.records[0]!.payload;
const target = {lesson_id: pass.lesson_id!, block_id: pass.block_id!};

function json(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function written(text = 'Can I have a sandwich, please?') {
  return submitWrittenAnswer({
    attemptId: pass.attempt_id,
    target,
    taskId: pass.task_id,
    text,
    substitute: false,
    supportLevel: 'none',
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockConsentOn = false;
  (getAppConfig as jest.Mock).mockReturnValue({
    apiBaseUrl: 'https://api.test/',
  });
  const db = openRealSqlite(':memory:');
  runMigrations(db);
  resetDatabaseForTests(db);
});

afterEach(() => {
  resetDatabaseForTests(null);
});

it('grades a written answer at once and keeps no text', async () => {
  mockedFetch.mockResolvedValue(
    json(200, {
      request_id: 'r',
      status: 'success',
      replayed: false,
      evaluation: pass,
    }),
  );
  await expect(written()).resolves.toEqual({
    status: 'evaluated',
    evaluation: pass,
  });
  const [url, init] = mockedFetch.mock.calls[0]!;
  expect(url).toBe('https://api.test/v1/evaluations/text');
  expect(JSON.parse(init.body)).toEqual({
    attempt_id: pass.attempt_id,
    target,
    text: 'Can I have a sandwich, please?',
    support_level: 'none',
    substitute: false,
  });
  const answer = getTaskAnswer(pass.attempt_id);
  expect(answer?.state).toBe('evaluated');
  expect(answer?.pendingText).toBeNull();
});

it('offline, the answer waits with its text and goes out later', async () => {
  mockedFetch.mockRejectedValueOnce(new TypeError('Network request failed'));
  await expect(written()).resolves.toEqual({status: 'waiting'});
  expect(getTaskAnswer(pass.attempt_id)?.pendingText).toBe(
    'Can I have a sandwich, please?',
  );

  mockedFetch.mockResolvedValueOnce(json(503, {}));
  await expect(sendWaitingWrittenAnswers()).resolves.toBe(0);

  mockedFetch.mockResolvedValueOnce(
    json(200, {
      request_id: 'r',
      status: 'success',
      replayed: false,
      evaluation: pass,
    }),
  );
  await expect(sendWaitingWrittenAnswers()).resolves.toBe(1);
  expect(getTaskAnswer(pass.attempt_id)?.pendingText).toBeNull();
  expect(getTaskAnswer(pass.attempt_id)?.evaluation?.outcome).toBe(
    'pass_independent',
  );
});

it('a refused answer is dropped, not resent', async () => {
  mockedFetch.mockResolvedValue(
    json(422, {error: {code: 'EVALUATION_TARGET_INVALID'}}),
  );
  await expect(written()).resolves.toEqual({status: 'rejected'});
  expect(getTaskAnswer(pass.attempt_id)).toBeNull();
  await expect(sendWaitingWrittenAnswers()).resolves.toBe(0);
});

it('polls every interval until the result is ready', async () => {
  mockedFetch
    .mockResolvedValueOnce(json(404, {}))
    .mockResolvedValueOnce(json(404, {}))
    .mockResolvedValueOnce(
      json(200, {request_id: 'r', status: 'success', evaluation: pass}),
    );
  const sleeps: number[] = [];
  const result = await pollEvaluation(pass.attempt_id, {
    sleep: async ms => {
      sleeps.push(ms);
    },
  });
  expect(result?.outcome).toBe('pass_independent');
  expect(sleeps).toEqual([2000, 2000]);
  expect(mockedFetch.mock.calls[0]![0]).toBe(
    `https://api.test/v1/evaluations/${pass.attempt_id}`,
  );
});

it('gives up after 20 seconds, and stops early on a pulled result', async () => {
  mockedFetch.mockResolvedValue(json(404, {}));
  let clock = 0;
  const timedOut = await pollEvaluation(pass.attempt_id, {
    now: () => clock,
    sleep: async ms => {
      clock += ms;
    },
  });
  expect(timedOut).toBeNull();
  expect(mockedFetch).toHaveBeenCalledTimes(10);

  mockedFetch.mockClear();
  saveEvaluation(pass);
  const pulled = await pollEvaluation(pass.attempt_id, {
    sleep: async () => undefined,
  });
  expect(pulled?.attempt_id).toBe(pass.attempt_id);
  expect(mockedFetch).not.toHaveBeenCalled();
});

it('remembers whether the Server grades speech, for offline use', async () => {
  expect(speechEvaluationKnownEnabled()).toBe(false);
  mockedFetch.mockResolvedValueOnce(
    json(200, {
      request_id: 'r',
      status: 'success',
      evaluation: {text: true, speech: true},
    }),
  );
  await expect(refreshSpeechEvaluation()).resolves.toBe(true);
  mockedFetch.mockRejectedValueOnce(new TypeError('offline'));
  await expect(refreshSpeechEvaluation()).resolves.toBe(true);
  expect(speechGradingReady()).toBe(false);
  mockConsentOn = true;
  expect(speechGradingReady()).toBe(true);
});

it('an answer without a result for a day is let go (H10)', () => {
  const answer = {
    attemptId: 'a',
    target,
    source: 'speech' as const,
    substitute: false,
    supportLevel: 'none' as const,
    recordingId: null,
    pendingText: null,
    state: 'sent' as const,
    evaluation: null,
    createdAt: '2026-10-09T00:00:00.000Z',
  };
  const created = Date.parse(answer.createdAt);
  expect(answerExpired(answer, created + ANSWER_EXPIRY_MS - 1)).toBe(false);
  expect(answerExpired(answer, created + ANSWER_EXPIRY_MS)).toBe(true);
  expect(
    answerExpired({...answer, evaluation: pass}, created + ANSWER_EXPIRY_MS),
  ).toBe(false);
  void getDatabase();
});
