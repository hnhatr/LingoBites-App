import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {open} from 'react-native-quick-sqlite';
import {getDatabase, resetDatabaseForTests} from '@shared/db/database';
import {DB_NAME} from '@shared/db/constants';
import {enqueueSyncOutboxEvent} from '@shared/db/syncOutboxCore';
import {
  listPendingSyncEvents,
  markSyncEventsFailed,
} from '../adapters/SyncOutboxRepository';
import {
  getAnswerEvents,
  getPracticeSession,
  savePracticeSession,
  savePracticeSet,
} from '@features/practice/logic/data/PracticeRepository';
import type {PracticeSet} from '@shared/schemas/practice';
import {
  answerCurrentQuestion,
  createSession,
} from '@features/practice/logic/sessionEngine';
import {drainOutboxOnce} from '../outboxSync';
import {MAX_SYNC_ATTEMPTS} from '../syncPolicy';

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
    requested_count: 2,
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
        source_snapshot: {
          snapshot_schema_version: 'snapshot-v1',
          source_text: 'secret snapshot must never sync',
        },
        provenance: {generation_attempt: 1, prompt_version: 'v1'},
        validation: {validator_version: 'v1', checks: [], passed: true},
        vocabulary_id: 'v1',
        options: [
          {id: 'q1-opt-1', text: 'a'},
          {id: 'q1-opt-2', text: 'b'},
        ],
        correct_option_id: 'q1-opt-2',
      },
      {
        id: 'q2',
        variant: 'meaning_choice',
        skill: 'vocabulary',
        difficulty: 'beginner',
        prompt_vi: 'Chon nghia 2',
        explanation_vi: 'Vi q2',
        source_refs: [{kind: 'vocabulary', id: 'v2'}],
        source_snapshot: {snapshot_schema_version: 'snapshot-v1'},
        provenance: {generation_attempt: 1, prompt_version: 'v1'},
        validation: {validator_version: 'v1', checks: [], passed: true},
        vocabulary_id: 'v2',
        options: [
          {id: 'q2-opt-1', text: 'c'},
          {id: 'q2-opt-2', text: 'd'},
        ],
        correct_option_id: 'q2-opt-1',
      },
    ],
    created_at: '2026-09-10T00:00:00.000Z',
    ready_at: '2026-09-10T00:01:00.000Z',
  };
}

function setupSession(sessionId = 'sess-1') {
  savePracticeSet(makeSet());
  createSession({set: makeSet(), sessionId});
}

const reviewSuccess = (ids: string[]) => ({
  ok: true,
  status: 200,
  json: jest.fn().mockResolvedValue({
    request_id: 'r',
    status: 'success',
    accepted: ids.length,
    duplicates: 0,
    accepted_ids: ids,
    duplicate_ids: [],
  }),
});

const practiceSuccess = (ids: string[]) => ({
  ok: true,
  status: 200,
  json: jest.fn().mockResolvedValue({
    accepted_ids: ids,
    duplicate_ids: [],
    rejected: [],
  }),
});

beforeEach(() => {
  __resetMockDatabases();
  resetDatabaseForTests(open({name: DB_NAME}));
  getDatabase();
  mockFetch.mockReset();
});

describe('P12 practice outbox sync', () => {
  it('acceptance 1: kill right after answer keeps the outbox event, later sync succeeds', async () => {
    setupSession();
    const {event} = answerCurrentQuestion({
      sessionId: 'sess-1',
      selectedOptionId: 'q1-opt-2',
      eventId: 'ev-1',
      answeredAt: '2026-09-10T00:06:00.000Z',
    });
    expect(event.is_correct).toBe(true);

    // Simulate kill: drop handles, reopen DB as a fresh process would.
    const fresh = open({name: DB_NAME});
    resetDatabaseForTests(fresh);
    getDatabase();

    // Local answer + cursor survived the kill…
    expect(getAnswerEvents('sess-1')).toHaveLength(1);
    expect(getPracticeSession('sess-1')?.current_index).toBe(1);
    // …and so did the outbox row (same transaction, no loss window).
    const pending = listPendingSyncEvents();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({id: 'ev-1', eventType: 'practice'});

    // Later drain pushes only to the practice endpoint and marks synced.
    mockFetch.mockResolvedValueOnce(practiceSuccess(['ev-1']));
    const outcome = await drainOutboxOnce();
    expect(outcome).toEqual({status: 'synced', syncedIds: ['ev-1']});
    expect(listPendingSyncEvents()).toHaveLength(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/v1/practice-events:batch');
    const body = JSON.parse(init.body as string);
    expect(body.contract_version).toBe(1);
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({
      event_id: 'ev-1',
      event_type: 'practice_answered',
      session_id: 'sess-1',
      sequence: 1,
    });

    // Allowlist: source IDs + outcome + timing only — no snapshot text,
    // no SRS fields.
    const payload = body.events[0].payload;
    expect(JSON.stringify(payload)).not.toContain('secret snapshot');
    expect(payload).not.toHaveProperty('source_snapshot');
    expect(payload).not.toHaveProperty('next_review_at');
    expect(payload).toMatchObject({
      session_id: 'sess-1',
      question_id: 'q1',
      selected_option_id: 'q1-opt-2',
      is_correct: true,
    });

    // practice_events mirror flipped to synced for D5 retention.
    expect(getAnswerEvents('sess-1')[0].sync_status).toBe('synced');
  });

  it('acceptance 2: server duplicate marks synced, no retry loop', async () => {
    setupSession();
    answerCurrentQuestion({
      sessionId: 'sess-1',
      selectedOptionId: 'q1-opt-2',
      eventId: 'ev-1',
      answeredAt: '2026-09-10T00:06:00.000Z',
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        accepted_ids: [],
        duplicate_ids: ['ev-1'],
        rejected: [],
      }),
    });

    await expect(drainOutboxOnce()).resolves.toEqual({
      status: 'synced',
      syncedIds: ['ev-1'],
    });
    expect(listPendingSyncEvents()).toHaveLength(0);

    // Redrain is idle — the server never sees the event twice (at-least-once
    // send, exactly-once effect via idempotency key).
    await expect(drainOutboxOnce()).resolves.toEqual({status: 'idle'});
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('acceptance 3: permanent rejection keeps audit and stops auto-retry', async () => {
    setupSession();
    answerCurrentQuestion({
      sessionId: 'sess-1',
      selectedOptionId: 'q1-opt-2',
      eventId: 'ev-1',
      answeredAt: '2026-09-10T00:06:00.000Z',
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        accepted_ids: [],
        duplicate_ids: [],
        rejected: [
          {event_id: 'ev-1', code: 'PAYLOAD_CONFLICT', retryable: false},
        ],
      }),
    });

    const outcome = await drainOutboxOnce();
    expect(outcome).toEqual({
      status: 'failed',
      errorCode: 'PAYLOAD_CONFLICT',
      message: 'PAYLOAD_CONFLICT',
      retryable: false,
    });

    // Audit kept: row still pending with the error recorded, not synced.
    const pending = listPendingSyncEvents();
    expect(pending).toHaveLength(1);
    expect(pending[0].attemptCount).toBe(1);
    expect(pending[0].lastError).toBe('PAYLOAD_CONFLICT');
    expect(pending[0].syncedAt).toBeNull();

    // After the cap the row is stuck and auto-drain stops (no infinite retry).
    for (let i = 1; i < MAX_SYNC_ATTEMPTS; i += 1) {
      markSyncEventsFailed(['ev-1'], 'PAYLOAD_CONFLICT');
    }
    mockFetch.mockClear();
    await expect(drainOutboxOnce()).resolves.toEqual({status: 'stuck'});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('drains a mixed review+practice queue without regressing review flow', async () => {
    setupSession();
    // Review row via the legacy path (defaults to review type).
    enqueueSyncOutboxEvent({
      id: 'rev-1',
      entityId: 'card-1',
      payload: {
        schema_version: 1,
        card_id: 'card-1',
        lesson_id: 'lesson-1',
        rating: 'remembered',
        reviewed_at: '2026-09-05T12:00:00.000Z',
        interval_days: 7,
        next_review_at: '2026-09-12T12:00:00.000Z',
      },
    });
    answerCurrentQuestion({
      sessionId: 'sess-1',
      selectedOptionId: 'q1-opt-2',
      eventId: 'ev-1',
      answeredAt: '2026-09-10T00:06:00.000Z',
    });

    mockFetch
      .mockResolvedValueOnce(reviewSuccess(['rev-1']))
      .mockResolvedValueOnce(practiceSuccess(['ev-1']));

    const outcome = await drainOutboxOnce();
    expect(outcome).toEqual({
      status: 'synced',
      syncedIds: expect.arrayContaining(['rev-1', 'ev-1']),
    });
    expect(listPendingSyncEvents()).toHaveLength(0);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const urls = mockFetch.mock.calls.map(call => (call as [string])[0]);
    expect(urls).toEqual([
      'http://localhost:3000/v1/review-events',
      'http://localhost:3000/v1/practice-events:batch',
    ]);
  });

  it('D4: practice sync never touches the SRS schedule', async () => {
    setupSession();
    answerCurrentQuestion({
      sessionId: 'sess-1',
      selectedOptionId: 'q1-opt-2',
      eventId: 'ev-1',
      answeredAt: '2026-09-10T00:06:00.000Z',
    });
    mockFetch.mockResolvedValueOnce(practiceSuccess(['ev-1']));
    await drainOutboxOnce();

    const db = getDatabase();
    const schedule = db.execute('SELECT * FROM review_schedule;');
    expect(schedule.rows?.length ?? 0).toBe(0);
  });

  it('unused import guard: savePracticeSession stays available', () => {
    expect(typeof savePracticeSession).toBe('function');
  });
});
