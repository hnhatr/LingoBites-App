import {open, QuickSQLiteConnection} from 'react-native-quick-sqlite';

import {DB_NAME} from '@core/db/constants';
import {resetDatabaseForTests} from '@core/db/database';
import {downgradePracticeMigrations, runMigrations} from '@core/db/migrations';
import type {
  AnswerEvent,
  PracticeSession,
  PracticeSet,
} from '@core/schemas/practice';

import {__resetMockDatabases} from '../../../../../../test-utils/sqliteMock';
import {
  getPracticeSession,
  getPracticeSet,
  purgeExpiredPracticeData,
  recordAnswerEvent,
  savePracticeSession,
  savePracticeSet,
} from '../PracticeRepository';

let db: QuickSQLiteConnection;

beforeEach(() => {
  __resetMockDatabases();
  db = open({name: DB_NAME});
  resetDatabaseForTests(db);
  runMigrations(db);
});

afterEach(() => {
  // No db.close() needed
});

describe('PracticeRepository', () => {
  const mockSet: PracticeSet = {
    id: 'set-1',
    contract_version: 1,
    status: 'ready',
    lesson_id: 'lesson-1',
    lesson_revision: 1,
    source_fingerprint: 'fp-1',
    config_hash: 'hash-1',
    difficulty: 'beginner',
    requested_count: 2,
    set_revision: 1,
    generator: {
      provider: 'test',
      model: 'test',
      prompt_version: 'v1',
      generator_version: 'v1',
    },
    questions: [
      {
        id: 'q-1',
        variant: 'meaning_choice',
        skill: 'vocabulary',
        difficulty: 'beginner',
        prompt_vi: 'test',
        explanation_vi: 'test',
        source_refs: [],
        source_snapshot: {snapshot_schema_version: 'v1'},
        provenance: {generation_attempt: 1, prompt_version: 'v1'},
        validation: {validator_version: 'v1', checks: [], passed: true},
        vocabulary_id: 'vocab-1',
        options: [{id: 'opt-1', text: 'Opt 1'}],
        correct_option_id: 'opt-1',
      },
    ],
    created_at: '2026-09-10T00:00:00Z',
    ready_at: '2026-09-10T00:01:00Z',
  };

  const mockSession: PracticeSession = {
    id: 'sess-1',
    practice_set_id: 'set-1',
    set_revision: 1,
    lesson_id: 'lesson-1',
    lesson_revision: 1,
    status: 'in_progress',
    question_order: ['q-1'],
    current_index: 0,
    attempt_no: 1,
    started_at: '2026-09-10T00:05:00Z',
    updated_at: '2026-09-10T00:05:00Z',
  };

  it('can save and retrieve a full practice set', () => {
    savePracticeSet(mockSet);
    const retrieved = getPracticeSet('set-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('set-1');
    expect(retrieved?.questions.length).toBe(1);
    expect(retrieved?.questions[0].variant).toBe('meaning_choice');
  });

  it('can save and retrieve a practice session', () => {
    savePracticeSession(mockSession);
    const retrieved = getPracticeSession('sess-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.status).toBe('in_progress');
    expect(retrieved?.current_index).toBe(0);
  });

  it('records answer event and updates session in one transaction', () => {
    savePracticeSet(mockSet);
    savePracticeSession(mockSession);

    const event: AnswerEvent = {
      event_id: 'event-1',
      contract_version: 1,
      session_id: 'sess-1',
      question_id: 'q-1',
      sequence: 1,
      selected_option_id: 'opt-1',
      is_correct: true,
      answered_at: '2026-09-10T00:06:00Z',
      duration_ms: 1000,
      try_index: 1,
      grading: {mode: 'device_deterministic', grader_version: 'v1'},
    };

    recordAnswerEvent(event, {
      status: 'completed',
      current_index: 1,
      updated_at: '2026-09-10T00:06:00Z',
      completed_at: '2026-09-10T00:06:00Z',
    });

    const session = getPracticeSession('sess-1');
    expect(session?.status).toBe('completed');
    expect(session?.current_index).toBe(1);

    const events = db.execute(
      'SELECT * FROM practice_events WHERE event_id = ?',
      ['event-1'],
    );
    expect(events.rows?.length).toBe(1);
  });

  it('enforces unique sequence per session', () => {
    savePracticeSet(mockSet);
    savePracticeSession(mockSession);

    const event: AnswerEvent = {
      event_id: 'event-1',
      contract_version: 1,
      session_id: 'sess-1',
      question_id: 'q-1',
      sequence: 1,
      selected_option_id: 'opt-1',
      is_correct: true,
      answered_at: '2026-09-10T00:06:00Z',
      duration_ms: 1000,
      try_index: 1,
      grading: {mode: 'device_deterministic', grader_version: 'v1'},
    };

    recordAnswerEvent(event, {
      status: 'in_progress',
      current_index: 1,
      updated_at: '2026-09-10T00:06:00Z',
    });

    const event2 = {...event, event_id: 'event-2'}; // Same sequence
    expect(() => {
      recordAnswerEvent(event2, {
        status: 'in_progress',
        current_index: 2,
        updated_at: '2026-09-10T00:07:00Z',
      });
    }).toThrow(); // Should throw due to UNIQUE constraint
  });

  it('purges expired practice data correctly and keeps in_progress sessions (HI-5)', () => {
    // Save old set
    savePracticeSet({
      ...mockSet,
      id: 'set-old',
      ready_at: '2025-01-01T00:00:00Z',
    });

    // Save old set but with in_progress session
    savePracticeSet({
      ...mockSet,
      id: 'set-old-active',
      ready_at: '2025-01-01T00:00:00Z',
    });
    savePracticeSession({
      ...mockSession,
      id: 'sess-active',
      practice_set_id: 'set-old-active',
      status: 'in_progress',
    });

    purgeExpiredPracticeData('2026-09-10T00:00:00Z');

    expect(getPracticeSet('set-old')).toBeNull(); // Expired and no active session
    expect(getPracticeSet('set-old-active')).not.toBeNull(); // Kept because of active session
    expect(getPracticeSession('sess-active')).not.toBeNull();
  });

  it('supports M8 down migration', () => {
    // Just verifying it executes without throwing
    expect(() => downgradePracticeMigrations(db)).not.toThrow();
  });
});
