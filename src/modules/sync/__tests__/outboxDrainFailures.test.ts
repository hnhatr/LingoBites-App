import {__resetMockDatabases} from '../../../../test-utils/sqliteMock';
import {open} from 'react-native-quick-sqlite';
import {getDatabase, resetDatabaseForTests} from '@shared/db/database';
import {DB_NAME} from '@shared/db/constants';
import {
  enqueueSyncOutboxEvent,
  listPendingSyncEvents,
} from '@shared/db/SyncOutboxRepository';
import {PRACTICE_EVENT_TYPE} from '@shared/db/types';
import type {SyncOutboxPayload} from '@shared/db/types';
import {savePracticeSet} from '@shared/db/PracticeRepository';
import type {PracticeSet} from '@shared/schemas/practice';
import {
  answerCurrentQuestion,
  createSession,
} from '@modules/practice/sessionEngine';
import {drainOutboxOnce} from '../outboxSync';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function makeSet(): PracticeSet {
  return {
    id: 'set-1',
    contract_version: 1,
    status: 'ready',
    lesson_id: 'lesson-1',
    lesson_revision: 3,
    source_fingerprint: 'fp-1',
    config_hash: 'hash-1',
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

function setupAnsweredSession() {
  savePracticeSet(makeSet());
  createSession({set: makeSet(), sessionId: 'sess-1'});
  answerCurrentQuestion({
    sessionId: 'sess-1',
    selectedOptionId: 'q1-opt-1',
    eventId: 'ev-1',
    answeredAt: '2026-09-10T00:06:00.000Z',
  });
}

beforeEach(() => {
  __resetMockDatabases();
  resetDatabaseForTests(open({name: DB_NAME}));
  getDatabase();
  mockFetch.mockReset();
});

describe('outbox drain failure paths (SYNC-06 / AC 3)', () => {
  it('transport failure reports retryable and bumps attempt_count', async () => {
    setupAnsweredSession();
    mockFetch.mockRejectedValueOnce(new Error('Network request failed'));

    const outcome = await drainOutboxOnce();

    expect(outcome).toEqual({
      status: 'failed',
      errorCode: 'NETWORK_ERROR',
      message: expect.any(String),
      retryable: true,
    });
    const pending = listPendingSyncEvents();
    expect(pending).toHaveLength(1);
    expect(pending[0].attemptCount).toBe(1);
    expect(pending[0].syncedAt).toBeNull();
  });

  it('retryable per-event rejection stays pending and reports retryable', async () => {
    setupAnsweredSession();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        accepted_ids: [],
        duplicate_ids: [],
        rejected: [{event_id: 'ev-1', code: 'INTERNAL_ERROR', retryable: true}],
      }),
    });

    const outcome = await drainOutboxOnce();

    expect(outcome).toEqual({
      status: 'failed',
      errorCode: 'INTERNAL_ERROR',
      message: 'INTERNAL_ERROR',
      retryable: true,
    });
    const pending = listPendingSyncEvents();
    expect(pending).toHaveLength(1);
    expect(pending[0].lastError).toBe('INTERNAL_ERROR');
  });

  it('non-retryable transport failure stops auto-retry with audit', async () => {
    setupAnsweredSession();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: jest.fn().mockResolvedValue({
        status: 'failed',
        error: {code: 'BAD_REQUEST', message: 'bad batch'},
      }),
    });

    const outcome = await drainOutboxOnce();

    expect(outcome).toEqual({
      status: 'failed',
      errorCode: 'BAD_REQUEST',
      message: 'bad batch',
      retryable: false,
    });
    const pending = listPendingSyncEvents();
    expect(pending).toHaveLength(1);
    expect(pending[0].attemptCount).toBe(1);
    expect(pending[0].lastError).toBe('bad batch');
  });

  it('malformed practice payload is audited without hitting the network', async () => {
    enqueueSyncOutboxEvent({
      id: 'ev-bad',
      entityId: 'sess-1',
      eventType: PRACTICE_EVENT_TYPE,
      // Deliberately malformed: missing session_id/sequence/question_id,
      // so the drain rejects it before any fetch (P7 allowlist guard).
      payload: {event_id: 'ev-bad'} as unknown as SyncOutboxPayload,
      createdAt: '2026-09-10T00:06:00.000Z',
    });

    const outcome = await drainOutboxOnce();

    expect(outcome).toEqual({
      status: 'failed',
      errorCode: 'INVALID_PRACTICE_PAYLOAD',
      message: 'Invalid practice event payload',
      retryable: false,
    });
    expect(mockFetch).not.toHaveBeenCalled();
    const pending = listPendingSyncEvents();
    expect(pending).toHaveLength(1);
    expect(pending[0].lastError).toBe('INVALID_PRACTICE_PAYLOAD');
  });
});
