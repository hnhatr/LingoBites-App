import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {open} from 'react-native-quick-sqlite';
import {getDatabase, resetDatabaseForTests} from '@shared/db/database';
import {DB_NAME} from '@shared/db/constants';
import {listPendingSyncEvents} from '@shared/db/SyncOutboxRepository';
import {getAnswerEvents, savePracticeSet} from '@shared/db/PracticeRepository';
import type {PracticeSet} from '@shared/schemas/practice';
import {
  answerCurrentQuestion,
  createSession,
} from '@modules/practice/sessionEngine';
import {drainOutboxOnce} from '../../outboxSync';
import {CHARACTERIZATION_INVARIANTS} from '@/test-support/characterization';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function makeSet(): PracticeSet {
  return {
    id: 'set-char',
    contract_version: 1,
    status: 'ready',
    lesson_id: 'lesson-1',
    lesson_revision: 1,
    source_fingerprint: 'fp',
    config_hash: 'hash',
    difficulty: 'beginner',
    requested_count: 1,
    set_revision: 1,
    generator: {
      provider: 'test',
      model: 'test',
      prompt_version: 'v1',
      generator_version: 'v1',
    },
    questions: [
      {
        id: 'q1',
        variant: 'meaning_choice',
        skill: 'vocabulary',
        difficulty: 'beginner',
        prompt_vi: 'Chon',
        explanation_vi: 'Vi',
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
    created_at: '2026-09-27T00:00:00.000Z',
    ready_at: '2026-09-27T00:01:00.000Z',
  };
}

beforeEach(() => {
  __resetMockDatabases();
  resetDatabaseForTests(open({name: DB_NAME}));
  getDatabase();
  mockFetch.mockReset();
});

describe(`${CHARACTERIZATION_INVARIANTS.INV_002} practice outbox replay (Jest mock DB/fetch smoke)`, () => {
  it('commits one practice outbox event per answer and treats server duplicates as synced without resend', async () => {
    savePracticeSet(makeSet());
    createSession({set: makeSet(), sessionId: 'sess-char'});
    answerCurrentQuestion({
      sessionId: 'sess-char',
      selectedOptionId: 'q1-opt-1',
      eventId: 'ev-char-1',
      answeredAt: '2026-09-27T00:06:00.000Z',
    });

    expect(getAnswerEvents('sess-char')).toHaveLength(1);
    expect(listPendingSyncEvents()).toHaveLength(1);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        accepted_ids: [],
        duplicate_ids: ['ev-char-1'],
        rejected: [],
      }),
    });

    await expect(drainOutboxOnce()).resolves.toEqual({
      status: 'synced',
      syncedIds: ['ev-char-1'],
    });
    expect(listPendingSyncEvents()).toHaveLength(0);

    await expect(drainOutboxOnce()).resolves.toEqual({status: 'idle'});
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
