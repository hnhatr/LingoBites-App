import {open} from 'react-native-quick-sqlite';
import {__resetMockDatabases} from '../../../../test-utils/sqliteMock';
import {DB_NAME} from '@shared/db/constants';
import {runMigrations} from '@shared/db/migrations';
import {resetDatabaseForTests, getDatabase} from '@shared/db/database';
import {
  findActiveSessionLocally,
  findReusablePracticeSetLocally,
  getAnswerEvents,
  getPracticeSession,
  getPracticeSet,
  purgeExpiredPracticeData,
  savePracticeSet,
} from '@shared/db/PracticeRepository';
import {listPendingSyncEvents} from '@modules/sync/adapters/SyncOutboxRepository';
import type {PracticeSet} from '@shared/schemas/practice';
import * as TokenStore from '@shared/security/lessonTokenStore';
import {getPracticeSetApi} from '@shared/api/practiceClient';
import {
  answerCurrentQuestion,
  createSession,
  resumeSession,
  summarizeSession,
} from '../sessionEngine';
import {drainOutboxOnce} from '@modules/sync';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const airplaneMode = () => {
  mockFetch.mockImplementation(() => {
    throw new Error('Network request failed (airplane mode)');
  });
};

const acceptAllPractice = () => {
  mockFetch.mockImplementation(
    async (url: unknown, init?: {body?: unknown}) => {
      const body = JSON.parse(String((init?.body as string) ?? '{}'));
      const ids = (body.events ?? []).map(
        (e: {event_id: string}) => e.event_id,
      );
      return {
        ok: true,
        status: 200,
        json: async () => ({
          accepted_ids: ids,
          duplicate_ids: [],
          rejected: [],
        }),
      };
    },
  );
};

function makeSet(id = 'set-e2e', lessonRevision = 3): PracticeSet {
  return {
    id,
    contract_version: 1,
    status: 'ready',
    lesson_id: 'lesson-e2e',
    lesson_revision: lessonRevision,
    source_fingerprint: 'fp-e2e',
    config_hash: 'hash-e2e',
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
        source_snapshot: {
          snapshot_schema_version: 'snapshot-v1',
          canonical_meaning: 'quả táo',
        },
        provenance: {generation_attempt: 1, prompt_version: 'v1'},
        validation: {validator_version: 'v1', checks: [], passed: true},
        vocabulary_id: 'v1',
        // Identical display texts: only the option ID may decide (HI-4).
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
        source_snapshot: {
          snapshot_schema_version: 'snapshot-v1',
          source_text: 'She works here',
        },
        provenance: {generation_attempt: 1, prompt_version: 'v1'},
        validation: {validator_version: 'v1', checks: [], passed: true},
        sentence_id: 's1',
        stem_with_placeholder: 'She ___ here',
        blank: {char_start: 4, char_end: 9, source_text: 'works'},
        options: [
          {id: 'q2-opt-1', text: 'works'},
          {id: 'q2-opt-2', text: 'work'},
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
        source_snapshot: {
          snapshot_schema_version: 'snapshot-v1',
          canonical_meaning: 'tạm biệt',
        },
        provenance: {generation_attempt: 1, prompt_version: 'v1'},
        validation: {validator_version: 'v1', checks: [], passed: true},
        vocabulary_id: 'v3',
        options: [
          {id: 'q3-opt-1', text: 'xin chào'},
          {id: 'q3-opt-2', text: 'tạm biệt'},
        ],
        correct_option_id: 'q3-opt-2',
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
  runMigrations(getDatabase());
  mockFetch.mockReset();
  jest
    .spyOn(TokenStore, 'getLessonToken')
    .mockResolvedValue({ok: true, token: 'test-token'});
});

afterEach(() => {
  jest.restoreAllMocks();
});

/**
 * P13 — device-side E2E cross-cutting for the full practice flow.
 * Every scenario runs against the real (mocked-sqlite) repository +
 * session engine + outbox drain: no mocked modules under test.
 */
describe('practice E2E cross-cutting (P13, device side)', () => {
  it('1. happy path: download → run full session offline → result → sync all', async () => {
    airplaneMode();

    // Download: the full immutable set is persisted before any session opens.
    savePracticeSet(makeSet());
    const session = createSession({set: makeSet(), sessionId: 'sess-happy'});
    expect(session.question_order).toEqual(['q1', 'q2', 'q3']);

    // Run: graded by option ID, fully offline — q1's duplicate texts must
    // not change the outcome (HI-4).
    expect(
      answerCurrentQuestion({
        sessionId: 'sess-happy',
        selectedOptionId: 'q1-opt-2',
        eventId: 'ev-1',
      }).event.is_correct,
    ).toBe(true);
    expect(
      answerCurrentQuestion({
        sessionId: 'sess-happy',
        selectedOptionId: 'q2-opt-2',
        eventId: 'ev-2',
      }).event.is_correct,
    ).toBe(false);
    const last = answerCurrentQuestion({
      sessionId: 'sess-happy',
      selectedOptionId: 'q3-opt-2',
      eventId: 'ev-3',
    });
    expect(last.session.status).toBe('completed');

    // Result reconciles from the event log.
    const summary = summarizeSession({
      sessionId: 'sess-happy',
      summaryId: 'sum-happy',
    });
    expect(summary).toMatchObject({
      total_questions: 3,
      answered: 3,
      correct: 2,
    });

    // Sync: one drain pushes every buffered event; the server accepts all.
    expect(listPendingSyncEvents()).toHaveLength(3);
    acceptAllPractice();
    await expect(drainOutboxOnce()).resolves.toEqual({
      status: 'synced',
      syncedIds: expect.arrayContaining(['ev-1', 'ev-2', 'ev-3']),
    });
    expect(listPendingSyncEvents()).toHaveLength(0);
    expect(
      getAnswerEvents('sess-happy').every(e => e.sync_status === 'synced'),
    ).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe(
      'http://localhost:3000/v1/practice-events:batch',
    );
  });

  it('2. retry generation: practice-only error surfaces, retry succeeds, lesson untouched (HI-1)', async () => {
    // Generation fails: the server reports a practice-scoped error…
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        request_id: 'r1',
        contract_version: 1,
        id: 'set-retry',
        status: 'generation_failed',
        lesson_id: 'lesson-e2e',
        lesson_revision: 3,
        questions: [],
        error: {
          code: 'MOCK_GENERATION_FAILED',
          message: 'mocked failure',
          retryable: false,
        },
      }),
    });
    const failed = await getPracticeSetApi('lesson-e2e', 'set-retry');
    expect(failed.status).toBe('generation_failed');
    if (failed.status !== 'generation_failed') throw new Error('unreachable');
    const failedBody = failed.practiceSet as {error?: {code?: unknown}};
    expect(failedBody.error?.code).toBe('MOCK_GENERATION_FAILED');

    // …and nothing practice writes locally: no set persisted, no session.
    expect(getPracticeSet('set-retry')).toBeNull();
    expect(getPracticeSession('sess-retry')).toBeNull();

    // Retry succeeds: the ready set downloads and a session starts on it.
    const readySet = makeSet('set-retry');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        request_id: 'r2',
        contract_version: 1,
        ...JSON.parse(JSON.stringify(readySet)),
        status: 'ready',
      }),
    });
    const retried = await getPracticeSetApi('lesson-e2e', 'set-retry');
    expect(retried.status).toBe('ready');
    if (retried.status !== 'ready') throw new Error('unreachable');
    savePracticeSet(readySet);
    const session = createSession({set: readySet, sessionId: 'sess-retry'});
    expect(session.status).toBe('in_progress');
    expect(session.lesson_revision).toBe(3);
  });

  it('3. crash/resume: kill mid-session → exact question, order, counters, no double count', async () => {
    airplaneMode();
    savePracticeSet(makeSet());
    createSession({set: makeSet(), sessionId: 'sess-crash'});
    answerCurrentQuestion({
      sessionId: 'sess-crash',
      selectedOptionId: 'q1-opt-2',
      eventId: 'ev-1',
    });
    answerCurrentQuestion({
      sessionId: 'sess-crash',
      selectedOptionId: 'q2-opt-1',
      eventId: 'ev-2',
    });

    // Kill: drop every handle and reopen as a fresh process would.
    const fresh = open({name: DB_NAME});
    resetDatabaseForTests(fresh);
    getDatabase();

    const snapshot = resumeSession('sess-crash');
    expect(snapshot.session.question_order).toEqual(['q1', 'q2', 'q3']);
    expect(snapshot.session.current_index).toBe(2);
    expect(snapshot.currentQuestion?.id).toBe('q3');
    expect(snapshot.answered).toBe(2);
    expect(snapshot.events.map(e => e.sequence)).toEqual([1, 2]);
    // Answer + cursor + outbox were written atomically: nothing lost.
    expect(listPendingSyncEvents()).toHaveLength(2);

    // Finish from exactly where it stopped.
    const last = answerCurrentQuestion({
      sessionId: 'sess-crash',
      selectedOptionId: 'q3-opt-2',
      eventId: 'ev-3',
    });
    expect(last.event.sequence).toBe(3);
    expect(last.session.status).toBe('completed');
    const sequences = getAnswerEvents('sess-crash')
      .map(e => e.sequence)
      .sort();
    expect(sequences).toEqual([1, 2, 3]);
    expect(
      summarizeSession({sessionId: 'sess-crash', summaryId: 'sum-crash'}),
    ).toMatchObject({
      answered: 3,
      correct: 3,
    });
  });

  it('4. offline full loop + replay-safe redrain: sync once, never resend', async () => {
    airplaneMode();
    savePracticeSet(makeSet());
    createSession({set: makeSet(), sessionId: 'sess-offline'});
    answerCurrentQuestion({
      sessionId: 'sess-offline',
      selectedOptionId: 'q1-opt-1',
      eventId: 'ev-1',
    });
    answerCurrentQuestion({
      sessionId: 'sess-offline',
      selectedOptionId: 'q2-opt-1',
      eventId: 'ev-2',
    });
    answerCurrentQuestion({
      sessionId: 'sess-offline',
      selectedOptionId: 'q3-opt-1',
      eventId: 'ev-3',
    });
    expect(mockFetch).not.toHaveBeenCalled();

    // Back online: a single batch syncs the whole result…
    acceptAllPractice();
    await expect(drainOutboxOnce()).resolves.toEqual({
      status: 'synced',
      syncedIds: expect.arrayContaining(['ev-1', 'ev-2', 'ev-3']),
    });
    const callsAfterSync = mockFetch.mock.calls.length;

    // …and redrain is idle: the server never sees the batch twice.
    await expect(drainOutboxOnce()).resolves.toEqual({status: 'idle'});
    expect(mockFetch.mock.calls.length).toBe(callsAfterSync);
    expect(getAnswerEvents('sess-offline')).toHaveLength(3);

    // Server-side duplicate also marks synced without a retry loop.
    savePracticeSet(makeSet('set-dup'));
    createSession({set: makeSet('set-dup'), sessionId: 'sess-dup'});
    answerCurrentQuestion({
      sessionId: 'sess-dup',
      selectedOptionId: 'q1-opt-2',
      eventId: 'ev-dup',
    });
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        accepted_ids: [],
        duplicate_ids: ['ev-dup'],
        rejected: [],
      }),
    });
    await expect(drainOutboxOnce()).resolves.toEqual({
      status: 'synced',
      syncedIds: ['ev-dup'],
    });
    await expect(drainOutboxOnce()).resolves.toEqual({status: 'idle'});
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('5. purge-while-open + lesson revision drift: session survives on its snapshot (HI-3 + HI-5)', async () => {
    // An old downloaded set with an in-progress session and a pending event.
    savePracticeSet({...makeSet(), ready_at: '2025-01-01T00:00:00.000Z'});
    createSession({set: makeSet(), sessionId: 'sess-purge'});
    answerCurrentQuestion({
      sessionId: 'sess-purge',
      selectedOptionId: 'q1-opt-2',
      eventId: 'ev-1',
    });

    purgeExpiredPracticeData('2026-09-10T00:00:00.000Z');

    // Practice retention keeps the open session, its set, and pending events.
    expect(getPracticeSet('set-e2e')).not.toBeNull();
    expect(getPracticeSession('sess-purge')?.status).toBe('in_progress');
    expect(getAnswerEvents('sess-purge')).toHaveLength(1);

    // The session still runs and grades from source_snapshot after the purge.
    const next = answerCurrentQuestion({
      sessionId: 'sess-purge',
      selectedOptionId: 'q2-opt-1',
      eventId: 'ev-2',
    });
    expect(next.event.is_correct).toBe(true);
    const snapshot = resumeSession('sess-purge');
    expect(snapshot.currentQuestion?.id).toBe('q3');
    expect(snapshot.set.questions[0].source_snapshot).toMatchObject({
      snapshot_schema_version: 'snapshot-v1',
      canonical_meaning: 'quả táo',
    });

    // Lesson moved to revision 4: the same-revision set is still reusable…
    expect(
      findReusablePracticeSetLocally('lesson-e2e', 3, 'hash-e2e')?.id,
    ).toBe('set-e2e');
    // …but there is no stale reuse for the new revision…
    expect(
      findReusablePracticeSetLocally('lesson-e2e', 4, 'hash-e2e'),
    ).toBeNull();
    // …but the started session continues on its frozen snapshot, with a
    // mismatch warning surfaced by the active-session lookup.
    expect(findActiveSessionLocally('lesson-e2e')?.id).toBe('sess-purge');
    const last = answerCurrentQuestion({
      sessionId: 'sess-purge',
      selectedOptionId: 'q3-opt-2',
      eventId: 'ev-3',
    });
    expect(last.session.status).toBe('completed');
    expect(
      summarizeSession({sessionId: 'sess-purge', summaryId: 'sum-purge'}),
    ).toMatchObject({
      answered: 3,
      correct: 3,
    });
  });
});
