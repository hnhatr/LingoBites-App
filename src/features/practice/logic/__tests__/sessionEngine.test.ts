import {open} from 'react-native-quick-sqlite';
import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {DB_NAME} from '@core/db/constants';
import {runMigrations} from '@core/db/migrations';
import {resetDatabaseForTests, getDatabase} from '@core/db/database';
import {
  savePracticeSet,
  getPracticeSession,
  getAnswerEvents,
  listPracticeSessionsForSet,
} from '../data/PracticeRepository';
import type {PracticeSet} from '@core/schemas/practice';
import {
  createSession,
  retrySession,
  answerCurrentQuestion,
  resumeSession,
  summarizeSession,
} from '../sessionEngine';

function makeSet(id = 'set-1'): PracticeSet {
  return {
    id,
    contract_version: 1,
    status: 'ready',
    lesson_id: 'lesson-1',
    lesson_revision: 3,
    source_fingerprint: 'fp-1',
    config_hash: 'hash-1',
    difficulty: 'beginner',
    requested_count: 3,
    set_revision: 1,
    generator: {
      provider: 'test',
      model: 'test',
      prompt_version: 'v1',
      generator_version: 'generator-v1',
    },
    questions: [
      {
        id: 'q1',
        variant: 'meaning_choice',
        skill: 'vocabulary',
        difficulty: 'beginner',
        prompt_vi: 'Chọn nghĩa đúng',
        explanation_vi: 'Vì q1',
        source_refs: [{kind: 'vocabulary', id: 'v1'}],
        source_snapshot: {snapshot_schema_version: 'snapshot-v1'},
        provenance: {generation_attempt: 1, prompt_version: 'v1'},
        validation: {validator_version: 'v1', checks: [], passed: true},
        vocabulary_id: 'v1',
        // Duplicate display text: only the option ID decides.
        options: [
          {id: 'q1-opt-1', text: 'quả táo'},
          {id: 'q1-opt-2', text: 'quả táo'},
          {id: 'q1-opt-3', text: 'quả cam'},
        ],
        correct_option_id: 'q1-opt-2',
      },
      {
        id: 'q2',
        variant: 'cloze_choice',
        skill: 'sentence',
        difficulty: 'beginner',
        prompt_vi: 'Điền vào chỗ trống',
        explanation_vi: 'Vì q2',
        source_refs: [{kind: 'sentence', id: 's1'}],
        source_snapshot: {snapshot_schema_version: 'snapshot-v1'},
        provenance: {generation_attempt: 1, prompt_version: 'v1'},
        validation: {validator_version: 'v1', checks: [], passed: true},
        sentence_id: 's1',
        stem_with_placeholder: 'I ___ a boy',
        blank: {char_start: 2, char_end: 4, source_text: 'am'},
        options: [
          {id: 'q2-opt-1', text: 'am'},
          {id: 'q2-opt-2', text: 'is'},
        ],
        correct_option_id: 'q2-opt-1',
      },
      {
        id: 'q3',
        variant: 'meaning_choice',
        skill: 'translation',
        difficulty: 'beginner',
        prompt_vi: 'Chọn bản dịch',
        explanation_vi: 'Vì q3',
        source_refs: [{kind: 'vocabulary', id: 'v3'}],
        source_snapshot: {snapshot_schema_version: 'snapshot-v1'},
        provenance: {generation_attempt: 1, prompt_version: 'v1'},
        validation: {validator_version: 'v1', checks: [], passed: true},
        vocabulary_id: 'v3',
        options: [
          {id: 'q3-opt-1', text: 'xin chào'},
          {id: 'q3-opt-2', text: 'tạm biệt'},
        ],
        correct_option_id: 'q3-opt-1',
      },
    ],
    created_at: '2026-09-10T00:00:00Z',
    ready_at: '2026-09-10T00:01:00Z',
  };
}

beforeEach(() => {
  __resetMockDatabases();
  const db = open({name: DB_NAME});
  resetDatabaseForTests(db);
  runMigrations(db);
});

describe('sessionEngine (offline, repository-backed)', () => {
  it('runs a full session offline and grades by option ID (acceptance 1 + 4)', () => {
    const fetchSpy = jest.fn();
    (global as unknown as {fetch: unknown}).fetch = fetchSpy;

    savePracticeSet(makeSet());
    const session = createSession({set: makeSet(), sessionId: 'sess-full'});
    expect(session.question_order).toEqual(['q1', 'q2', 'q3']);
    expect(session.attempt_no).toBe(1);
    expect(session.status).toBe('in_progress');

    // q1 has two identically-worded options; only q1-opt-2 is correct.
    const r1 = answerCurrentQuestion({
      sessionId: 'sess-full',
      selectedOptionId: 'q1-opt-2',
      eventId: 'ev-1',
    });
    expect(r1.event.is_correct).toBe(true);
    expect(r1.event.grading).toEqual({
      mode: 'device_deterministic',
      grader_version: 'grader-v1',
    });
    expect(r1.session.current_index).toBe(1);

    const r2 = answerCurrentQuestion({
      sessionId: 'sess-full',
      selectedOptionId: 'q2-opt-2',
      eventId: 'ev-2',
    });
    expect(r2.event.is_correct).toBe(false);

    const r3 = answerCurrentQuestion({
      sessionId: 'sess-full',
      selectedOptionId: 'q3-opt-1',
      eventId: 'ev-3',
    });
    expect(r3.event.is_correct).toBe(true);
    expect(r3.session.status).toBe('completed');
    expect(r3.session.current_index).toBe(3);

    const summary = summarizeSession({
      sessionId: 'sess-full',
      summaryId: 'sum-1',
    });
    expect(summary.total_questions).toBe(3);
    expect(summary.answered).toBe(3);
    expect(summary.correct).toBe(2);
    expect(summary.score_percent).toBe(67);
    expect(summary.breakdown).toEqual({vocabulary: 1, translation: 1});
    expect(summary.review_candidates).toEqual([
      {source_kind: 'sentence', source_id: 's1', wrong_count: 1},
    ]);

    // No network or AI was touched at any point in the run.
    expect(fetchSpy).not.toHaveBeenCalled();
    delete (global as unknown as {fetch?: unknown}).fetch;
  });

  it('resumes after an app kill with exact order, cursor and counters (acceptance 3)', () => {
    savePracticeSet(makeSet());
    createSession({set: makeSet(), sessionId: 'sess-resume'});
    answerCurrentQuestion({
      sessionId: 'sess-resume',
      selectedOptionId: 'q1-opt-2',
      eventId: 'ev-1',
    });

    // Simulate a kill: drop every in-memory handle and reopen the database,
    // as a fresh process would. Only the session id survives.
    const fresh = open({name: DB_NAME});
    resetDatabaseForTests(fresh);
    getDatabase();

    const snapshot = resumeSession('sess-resume');
    expect(snapshot.session.question_order).toEqual(['q1', 'q2', 'q3']);
    expect(snapshot.session.current_index).toBe(1);
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.answered).toBe(1);
    expect(snapshot.correct).toBe(1);
    expect(snapshot.gradedAnswered).toBe(1);
    expect(snapshot.accuracy).toBe(100);
    expect(snapshot.currentQuestion?.id).toBe('q2');
    expect(snapshot.isFinished).toBe(false);

    // Continue from exactly where it stopped.
    const r2 = answerCurrentQuestion({
      sessionId: 'sess-resume',
      selectedOptionId: 'q2-opt-1',
      eventId: 'ev-2',
    });
    expect(r2.event.sequence).toBe(2);
    expect(resumeSession('sess-resume').currentQuestion?.id).toBe('q3');
  });

  it('freezes a custom question order at creation and never recomputes it', () => {
    savePracticeSet(makeSet());
    const session = createSession({
      set: makeSet(),
      sessionId: 'sess-order',
      questionOrder: ['q3', 'q1', 'q2'],
    });
    expect(session.question_order).toEqual(['q3', 'q1', 'q2']);
    answerCurrentQuestion({
      sessionId: 'sess-order',
      selectedOptionId: 'q3-opt-1',
      eventId: 'ev-1',
    });
    const snapshot = resumeSession('sess-order');
    expect(snapshot.session.question_order).toEqual(['q3', 'q1', 'q2']);
    expect(snapshot.currentQuestion?.id).toBe('q1');
  });

  it('rejects an invalid frozen order', () => {
    savePracticeSet(makeSet());
    expect(() =>
      createSession({
        set: makeSet(),
        sessionId: 'sess-bad',
        questionOrder: ['q1', 'q1', 'q2'],
      }),
    ).toThrow();
    expect(() =>
      createSession({
        set: makeSet(),
        sessionId: 'sess-bad-2',
        questionOrder: ['q1', 'q2'],
      }),
    ).toThrow();
  });

  it('retry ("Làm lại") creates a new session + attempt_no and keeps history', () => {
    savePracticeSet(makeSet());
    createSession({set: makeSet(), sessionId: 'sess-a1'});
    answerCurrentQuestion({
      sessionId: 'sess-a1',
      selectedOptionId: 'q1-opt-2',
      eventId: 'ev-1',
    });
    answerCurrentQuestion({
      sessionId: 'sess-a1',
      selectedOptionId: 'q2-opt-1',
      eventId: 'ev-2',
    });
    answerCurrentQuestion({
      sessionId: 'sess-a1',
      selectedOptionId: 'q3-opt-1',
      eventId: 'ev-3',
    });

    const retry = retrySession({sessionId: 'sess-a1', newSessionId: 'sess-a2'});
    expect(retry.id).toBe('sess-a2');
    expect(retry.attempt_no).toBe(2);
    expect(retry.status).toBe('in_progress');
    expect(retry.current_index).toBe(0);
    expect(retry.question_order).toEqual(['q1', 'q2', 'q3']);

    // History is untouched: old session + its events still exist.
    const old = getPracticeSession('sess-a1');
    expect(old?.status).toBe('completed');
    expect(getAnswerEvents('sess-a1')).toHaveLength(3);
    expect(getAnswerEvents('sess-a2')).toHaveLength(0);
    expect(listPracticeSessionsForSet('set-1')).toHaveLength(2);
  });

  it('auto-increments attempt_no for fresh sessions on the same set', () => {
    savePracticeSet(makeSet());
    const s1 = createSession({set: makeSet(), sessionId: 's1'});
    const s2 = createSession({set: makeSet(), sessionId: 's2'});
    expect(s1.attempt_no).toBe(1);
    expect(s2.attempt_no).toBe(2);
  });

  it('records answer event and cursor atomically; guards double completion', () => {
    savePracticeSet(makeSet());
    createSession({set: makeSet(), sessionId: 'sess-guard'});
    answerCurrentQuestion({
      sessionId: 'sess-guard',
      selectedOptionId: 'q1-opt-1',
      eventId: 'ev-1',
    });
    answerCurrentQuestion({
      sessionId: 'sess-guard',
      selectedOptionId: 'q2-opt-1',
      eventId: 'ev-2',
    });
    answerCurrentQuestion({
      sessionId: 'sess-guard',
      selectedOptionId: 'q3-opt-2',
      eventId: 'ev-3',
    });
    expect(() =>
      answerCurrentQuestion({
        sessionId: 'sess-guard',
        selectedOptionId: 'q3-opt-1',
        eventId: 'ev-4',
      }),
    ).toThrow();
    expect(getAnswerEvents('sess-guard')).toHaveLength(3);
  });

  it('persists grading metadata with grader_version on every event (acceptance 5)', () => {
    savePracticeSet(makeSet());
    createSession({set: makeSet(), sessionId: 'sess-meta'});
    const {event} = answerCurrentQuestion({
      sessionId: 'sess-meta',
      selectedOptionId: 'q1-opt-1',
      eventId: 'ev-1',
    });
    expect(event.grading.mode).toBe('device_deterministic');
    expect(event.grading.grader_version).toBe('grader-v1');
    const [stored] = getAnswerEvents('sess-meta');
    expect(stored.grading.grader_version).toBe('grader-v1');
  });
});
