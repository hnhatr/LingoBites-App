import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import type {LessonActivityAttemptRow} from '@core/sync/activityAttempts';
import {createTaskAnswer, saveEvaluation} from '@core/sync/taskAnswers';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';
import {seedSnapshot} from '@test/support/lessonFlow';

import {lessonOutcomeView} from '../lessonOutcome';

jest.mock('@features/speaking', () => ({
  isEvaluationConsentOn: () => false,
  queueLessonTaskRecording: jest.fn(),
}));

/** PR 16 (G2, G13): what step 6 says about the lesson. */
const snapshot = seedSnapshot();
const NOW = Date.parse('2026-10-09T10:00:00.000Z');
const stepFive = snapshot.blocks.find(
  block => block.type === 'activity' && block.step === 5,
)!;

function attempt(
  blockId: string,
  step: number,
  outcome: LessonActivityAttemptRow['outcome'],
): LessonActivityAttemptRow {
  return {
    id: `${blockId}-${outcome}`,
    activity: 'role_play',
    blockId,
    contentRevision: 1,
    step,
    outcome,
    supportLevel: 'none',
    occurredAt: '2026-10-09T09:00:00.000Z',
  };
}

const practice = snapshot.blocks
  .filter(
    block =>
      block.type === 'activity' &&
      block.step != null &&
      block.step >= 2 &&
      block.step <= 4,
  )
  .map(block => attempt(block.id, block.step!, 'pass_independent'));

function answer(
  attemptId: string,
  evaluation: {outcome: string; substitute: boolean} | null,
) {
  createTaskAnswer({
    attemptId,
    ownerUserId: null,
    target: {lesson_id: snapshot.id, block_id: stepFive.id},
    taskId: '66666666-6666-4666-8666-666666666601',
    source: 'text',
    substitute: evaluation?.substitute ?? false,
    supportLevel: 'none',
    state: 'sent',
    now: '2026-10-09T09:30:00.000Z',
  });
  if (!evaluation) return;
  saveEvaluation({
    attempt_id: attemptId,
    lesson_id: snapshot.id,
    unit_id: null,
    block_id: stepFive.id,
    task_id: '66666666-6666-4666-8666-666666666601',
    source: 'text',
    substitute: evaluation.substitute,
    support_level: 'none',
    outcome: evaluation.outcome as 'fail',
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
    evaluated_at: '2026-10-09T09:31:00.000Z',
  });
}

beforeEach(() => {
  const db = openRealSqlite();
  resetDatabaseForTests(db);
  runMigrations(db);
});

afterEach(() => {
  resetDatabaseForTests(null);
});

it('says nothing while practice is not done', () => {
  expect(lessonOutcomeView(snapshot, [], NOW).label).toBe('in_progress');
});

it('stops at "practice done" when step 5 is skipped or failed (A14)', () => {
  expect(lessonOutcomeView(snapshot, practice, NOW).label).toBe(
    'practice_done',
  );
  answer('77777777-7777-4777-8777-777777777701', {
    outcome: 'fail',
    substitute: false,
  });
  expect(lessonOutcomeView(snapshot, practice, NOW).label).toBe(
    'practice_done',
  );
});

it('does not pass on an answer written instead of spoken', () => {
  answer('77777777-7777-4777-8777-777777777702', {
    outcome: 'pass_independent',
    substitute: true,
  });
  expect(lessonOutcomeView(snapshot, practice, NOW).label).toBe(
    'practice_done',
  );
});

it('passes on the device after a scorer or self-assessed pass', () => {
  answer('77777777-7777-4777-8777-777777777703', {
    outcome: 'pass_independent',
    substitute: false,
  });
  expect(lessonOutcomeView(snapshot, practice, NOW)).toEqual({
    label: 'passed',
    confirmed: false,
  });
  getDatabase().execute('DELETE FROM task_answers;');
  expect(
    lessonOutcomeView(
      snapshot,
      [attempt(stepFive.id, 5, 'pass_independent'), ...practice],
      NOW,
    ).label,
  ).toBe('passed');
});

it('waits for a result that is on its way, not one a day old', () => {
  answer('77777777-7777-4777-8777-777777777704', null);
  expect(lessonOutcomeView(snapshot, practice, NOW).label).toBe(
    'awaiting_result',
  );
  expect(
    lessonOutcomeView(snapshot, practice, NOW + 2 * 86_400_000).label,
  ).toBe('practice_done');
});

it("takes the Server's pass, even without local attempts", () => {
  getDatabase().execute(
    `INSERT INTO lesson_outcomes (lesson_id, practice_completed_at, passed_at,
       passed_by, updated_at) VALUES (?, 'a', 'b', 'service', 'b');`,
    [snapshot.id],
  );
  expect(lessonOutcomeView(snapshot, [], NOW)).toEqual({
    label: 'passed',
    confirmed: true,
  });
});
