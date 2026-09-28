import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import type {PracticeSet} from '@core/schemas/practice';
import {
  getAnswerEvents,
  markPracticeEventsSynced,
  purgeExpiredPracticeData,
  savePracticeSet,
} from '../../data/PracticeRepository';
import {answerCurrentQuestion, createSession} from '../../sessionEngine';
import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@/test-support/adversarial/realSqlite';

/**
 * LING-98 adversarial review (INV-001/005 with INV-002 practice events).
 * Production practice repository + session engine on a real SQLite engine:
 * the retention purge (D5) may only delete answer events the server has
 * acknowledged; an unsynced answer must stay readable locally, and the
 * `sync_status` mirror may only flip the acknowledged ids (HI-5).
 */

const OLD = '2020-01-01T00:00:00.000Z';
const NOW = '2026-09-28T00:00:00.000Z';

function makeSet(): PracticeSet {
  return {
    id: 'adv-ret-set',
    contract_version: 1,
    status: 'ready',
    lesson_id: 'adv-ret-lesson',
    lesson_revision: 1,
    source_fingerprint: 'fp',
    config_hash: 'hash',
    difficulty: 'beginner',
    requested_count: 2,
    set_revision: 1,
    generator: {
      provider: 'test',
      model: 'test',
      prompt_version: 'v1',
      generator_version: 'v1',
    },
    questions: ['q1', 'q2'].map(id => ({
      id,
      variant: 'meaning_choice' as const,
      skill: 'vocabulary' as const,
      difficulty: 'beginner' as const,
      prompt_vi: 'Chon',
      explanation_vi: 'Vi',
      source_refs: [{kind: 'vocabulary' as const, id: 'v1'}],
      source_snapshot: {snapshot_schema_version: 'snapshot-v1'},
      provenance: {generation_attempt: 1, prompt_version: 'v1'},
      validation: {validator_version: 'v1', checks: [], passed: true},
      vocabulary_id: 'v1',
      options: [
        {id: `${id}-opt-1`, text: 'a'},
        {id: `${id}-opt-2`, text: 'b'},
      ],
      correct_option_id: `${id}-opt-1`,
    })),
    created_at: OLD,
    ready_at: NOW,
  } as PracticeSet;
}

let db: RealSqliteConnection;

beforeEach(() => {
  db = openRealSqlite(':memory:');
  resetDatabaseForTests(db);
  runMigrations(db);
});

afterEach(() => {
  resetDatabaseForTests(null);
});

describe('ADV / INV-001/005 practice retention on real SQLite (moved practice repository)', () => {
  it('ADV-H09 / INV-001/005: retention purge keeps unsynced answers and only the acknowledged id is marked synced', () => {
    savePracticeSet(makeSet());
    createSession({set: makeSet(), sessionId: 'adv-ret-sess'});
    answerCurrentQuestion({
      sessionId: 'adv-ret-sess',
      selectedOptionId: 'q1-opt-1',
      eventId: 'adv-ret-acked',
      answeredAt: OLD,
    });
    answerCurrentQuestion({
      sessionId: 'adv-ret-sess',
      selectedOptionId: 'q2-opt-2',
      eventId: 'adv-ret-pending',
      answeredAt: OLD,
    });

    // Server acknowledged only the first answer.
    expect(markPracticeEventsSynced(['adv-ret-acked'])).toBe(1);
    const status = db.execute(
      'SELECT event_id, sync_status FROM practice_events ORDER BY sequence',
    ).rows!._array;
    expect(status).toEqual([
      {event_id: 'adv-ret-acked', sync_status: 'synced'},
      {event_id: 'adv-ret-pending', sync_status: 'pending'},
    ]);

    // Both answers are older than retention; only the synced one may go.
    purgeExpiredPracticeData(NOW);
    expect(getAnswerEvents('adv-ret-sess').map(e => e.event_id)).toEqual([
      'adv-ret-pending',
    ]);
    // Its outbox row is untouched by retention.
    expect(
      db
        .execute(
          "SELECT COUNT(*) AS c FROM sync_outbox WHERE id = 'adv-ret-pending' AND synced_at IS NULL",
        )
        .rows!.item(0),
    ).toEqual({c: 1});
  });
});
