import {__resetMockDatabases} from '../../../../test-utils/sqliteMock';
import {open} from 'react-native-quick-sqlite';
import {getDatabase, resetDatabaseForTests} from '@shared/db/database';
import {DB_NAME} from '@shared/db/constants';
import {
  getPracticeSession,
  markPracticeEventsSynced,
  savePracticeSet,
} from '../data/PracticeRepository';
import type {PracticeSet} from '@shared/schemas/practice';
import {
  abandonSession,
  answerCurrentQuestion,
  createSession,
  pauseSession,
  resumeSession,
  retrySession,
} from '../sessionEngine';

function makeSet(): PracticeSet {
  return {
    id: 'set-lifecycle',
    contract_version: 1,
    status: 'ready',
    lesson_id: 'lesson-lifecycle',
    lesson_revision: 3,
    source_fingerprint: 'fp-lifecycle',
    config_hash: 'hash-lifecycle',
    difficulty: 'beginner',
    requested_count: 1,
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
        prompt_vi: 'Chon nghia',
        explanation_vi: 'Vi q1',
        source_refs: [{kind: 'vocabulary', id: 'v1'}],
        source_snapshot: {snapshot_schema_version: 'snapshot-v1'},
        provenance: {generation_attempt: 1, prompt_version: 'v1'},
        validation: {validator_version: 'v1', checks: [], passed: true},
        vocabulary_id: 'v1',
        options: [
          {id: 'q1-opt-1', text: 'a'},
          {id: 'q1-opt-2', text: 'b'},
        ],
        correct_option_id: 'q1-opt-1',
      },
    ],
    created_at: '2026-09-10T00:00:00.000Z',
    ready_at: '2026-09-10T00:01:00.000Z',
  };
}

beforeEach(() => {
  __resetMockDatabases();
  resetDatabaseForTests(open({name: DB_NAME}));
  getDatabase();
  savePracticeSet(makeSet());
});

describe('session lifecycle guards', () => {
  it('pause is a no-op returning the persisted session', () => {
    const session = createSession({set: makeSet(), sessionId: 'sess-1'});
    expect(pauseSession('sess-1')).toEqual(session);
  });

  it('abandon flips in_progress to abandoned and is idempotent', () => {
    createSession({set: makeSet(), sessionId: 'sess-1'});

    const abandoned = abandonSession('sess-1');
    expect(abandoned.status).toBe('abandoned');
    expect(getPracticeSession('sess-1')?.status).toBe('abandoned');
    expect(abandonSession('sess-1').status).toBe('abandoned');
  });

  it('answering a completed session throws instead of appending', () => {
    createSession({set: makeSet(), sessionId: 'sess-1'});
    answerCurrentQuestion({
      sessionId: 'sess-1',
      selectedOptionId: 'q1-opt-1',
      eventId: 'ev-1',
    });
    expect(getPracticeSession('sess-1')?.status).toBe('completed');

    expect(() =>
      answerCurrentQuestion({
        sessionId: 'sess-1',
        selectedOptionId: 'q1-opt-1',
        eventId: 'ev-2',
      }),
    ).toThrow('is not in progress');
  });

  it('unknown sessions throw on answer, resume, pause, and abandon', () => {
    expect(() =>
      answerCurrentQuestion({sessionId: 'nope', selectedOptionId: 'x'}),
    ).toThrow('practice session not found');
    expect(() => resumeSession('nope')).toThrow('practice session not found');
    expect(() => pauseSession('nope')).toThrow('practice session not found');
    expect(() => abandonSession('nope')).toThrow('practice session not found');
  });

  it('retry on an unknown session throws instead of forking history', () => {
    expect(() => retrySession({sessionId: 'nope'})).toThrow(
      'practice session not found',
    );
  });

  it('markPracticeEventsSynced short-circuits on an empty batch', () => {
    expect(markPracticeEventsSynced([])).toBe(0);
  });
});
