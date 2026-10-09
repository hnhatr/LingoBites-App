import {readFileSync} from 'fs';
import {join} from 'path';

import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import type {EvaluationPayload} from '@core/schemas/evaluation';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {
  applyEvaluationRecord,
  createTaskAnswer,
  getTaskAnswer,
  latestTaskAnswerForBlock,
  listUnsentWrittenAnswers,
  markTaskAnswerSent,
  subscribeTaskAnswers,
} from '../taskAnswers';

/**
 * PR 14: answers sent to the Server's scorer and their results, kept in
 * `task_answers` (schema v9).
 */
const pull = JSON.parse(
  readFileSync(
    join(
      __dirname,
      '../../schemas/__tests__/fixtures/valid-sync-evaluation-pull-response.json',
    ),
    'utf8',
  ),
) as {records: Array<Record<string, any>>};

const passRecord = pull.records[0]!;
const pass = passRecord.payload as EvaluationPayload;

beforeEach(() => {
  const db = openRealSqlite();
  resetDatabaseForTests(db);
  runMigrations(db);
  getDatabase();
});

it('a written answer waits with its text, which goes once it is sent', () => {
  createTaskAnswer({
    attemptId: pass.attempt_id,
    ownerUserId: 'u1',
    target: {lesson_id: pass.lesson_id!, block_id: pass.block_id!},
    taskId: pass.task_id,
    source: 'text',
    substitute: false,
    supportLevel: 'none',
    pendingText: 'Can I have a sandwich, please?',
    state: 'waiting_upload',
    now: '2026-10-09T03:19:00.000Z',
  });
  expect(listUnsentWrittenAnswers().map(answer => answer.pendingText)).toEqual([
    'Can I have a sandwich, please?',
  ]);
  markTaskAnswerSent(pass.attempt_id);
  const sent = getTaskAnswer(pass.attempt_id);
  expect(sent?.state).toBe('sent');
  expect(sent?.pendingText).toBeNull();
  expect(listUnsentWrittenAnswers()).toEqual([]);
});

it('a pulled result completes the local answer and notifies listeners', () => {
  createTaskAnswer({
    attemptId: pass.attempt_id,
    ownerUserId: 'u1',
    target: {lesson_id: pass.lesson_id!, block_id: pass.block_id!},
    taskId: pass.task_id,
    source: 'text',
    substitute: false,
    supportLevel: 'none',
    state: 'sent',
  });
  const listener = jest.fn();
  const unsubscribe = subscribeTaskAnswers(listener);
  applyEvaluationRecord(passRecord as never);
  unsubscribe();
  expect(listener).toHaveBeenCalled();
  const answer = latestTaskAnswerForBlock(pass.block_id!);
  expect(answer?.state).toBe('evaluated');
  expect(answer?.evaluation?.outcome).toBe('pass_independent');
  expect(answer?.evaluation?.reference_en).toBe(
    'Can I have a sandwich, please?',
  );
});

it('a result of an answer made on another device creates its row', () => {
  for (const record of pull.records) {
    applyEvaluationRecord(record as never);
  }
  // Pulled twice: nothing changes.
  applyEvaluationRecord(pull.records[1] as never);
  const other = pull.records[1]!.payload as EvaluationPayload;
  const answer = getTaskAnswer(other.attempt_id);
  expect(answer?.state).toBe('evaluated');
  expect(answer?.substitute).toBe(true);
  expect(answer?.evaluation?.primary_issue).toEqual({
    kind: 'criterion',
    criterion: 'purpose',
  });
  const count = getDatabase()
    .execute('SELECT COUNT(*) AS n FROM task_answers;')
    .rows?.item(0);
  expect(count).toEqual({n: 2});
});

it('a malformed or deleted record is ignored', () => {
  applyEvaluationRecord({...passRecord, payload: {outcome: 'x'}} as never);
  applyEvaluationRecord({...passRecord, tombstone: true} as never);
  expect(getTaskAnswer(pass.attempt_id)).toBeNull();
});
