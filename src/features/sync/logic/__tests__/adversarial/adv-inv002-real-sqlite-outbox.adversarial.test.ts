import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {validFullOutput} from '@core/fixtures/index';
import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {listPendingSyncEvents} from '../../adapters/SyncOutboxRepository';
import {
  recordFlashcardRating,
  saveFlashcard,
} from '@features/review/logic/FlashcardRepository';
import {
  getAnswerEvents,
  savePracticeSet,
} from '@features/practice/logic/data/PracticeRepository';
import type {PracticeSet} from '@core/schemas/practice';
import {
  answerCurrentQuestion,
  createSession,
} from '@features/practice/logic/sessionEngine';
import {drainOutboxOnce} from '../../outboxSync';
import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@/test-support/adversarial/realSqlite';

/**
 * LING-93 adversarial review (INV-002). Production repositories,
 * `withTransaction` and `drainOutboxOnce` run on a real SQLite engine and
 * drain to a real local HTTP server with id-based idempotency. Failure is
 * injected only at the boundary (SQLite trigger, dropped HTTP response).
 */

function makeSet(): PracticeSet {
  return {
    id: 'adv-set',
    contract_version: 1,
    status: 'ready',
    lesson_id: 'adv-lesson',
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
    created_at: '2026-09-27T10:00:00.000Z',
    ready_at: '2026-09-27T10:01:00.000Z',
  } as PracticeSet;
}

type Server = {
  port: number;
  close: () => Promise<void>;
  effects: {review: Map<string, number>; practice: Map<string, number>};
  posts: () => number;
  /** Drop the HTTP response for the next N requests AFTER applying effects. */
  dropNextResponses: (n: number) => void;
};

async function startServer(): Promise<Server> {
  const effects = {
    review: new Map<string, number>(),
    practice: new Map<string, number>(),
  };
  let posts = 0;
  let toDrop = 0;
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      posts += 1;
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      const isReview = req.url === '/v1/review-events';
      const isPractice = req.url === '/v1/practice-events:batch';
      if (!isReview && !isPractice) {
        res.writeHead(404);
        res.end();
        return;
      }
      const store = isReview ? effects.review : effects.practice;
      const accepted_ids: string[] = [];
      const duplicate_ids: string[] = [];
      for (const event of body.events ?? []) {
        const id = isReview ? event.id : event.event_id;
        // Count every delivery; a real server applies an effect only once per
        // id, so "effect applied twice" == count > 1 for a *new* id.
        if (store.has(id)) {
          duplicate_ids.push(id);
        } else {
          accepted_ids.push(id);
        }
        store.set(id, (store.get(id) ?? 0) + 1);
      }
      if (toDrop > 0) {
        toDrop -= 1;
        // Unknown outcome: effects committed server-side, response lost.
        req.socket.destroy();
        return;
      }
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(
        JSON.stringify(
          isReview
            ? {
                request_id: 'adv',
                status: 'success',
                accepted: accepted_ids.length,
                duplicates: duplicate_ids.length,
                accepted_ids,
                duplicate_ids,
              }
            : {accepted_ids, duplicate_ids, rejected: []},
        ),
      );
    });
  });
  await new Promise<void>(resolve =>
    server.listen(0, '127.0.0.1', () => resolve()),
  );
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('failed to bind');
  }
  return {
    port: address.port,
    close: () =>
      new Promise(resolve => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
    effects,
    posts: () => posts,
    dropNextResponses: n => {
      toDrop = n;
    },
  };
}

function fetchFor(port: number): typeof fetch {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    return fetch(
      url.replace('http://localhost:3000', `http://127.0.0.1:${port}`),
      init,
    );
  };
}

let dbFile: string;
let db: RealSqliteConnection;

function openFileDb(): RealSqliteConnection {
  const connection = openRealSqlite(dbFile);
  resetDatabaseForTests(connection);
  runMigrations(connection);
  return connection;
}

function count(sql: string): number {
  return Number(
    (db.execute(sql).rows?.item(0) as {c: number} | undefined)?.c ?? -1,
  );
}

function seedPracticeSession(sessionId: string) {
  savePracticeSet(makeSet());
  createSession({set: makeSet(), sessionId});
}

function seedFlashcard(): string {
  const saved = saveFlashcard({
    lessonId: 'adv-review-lesson',
    vocabulary: validFullOutput.vocabulary[0],
    now: '2026-09-27T10:00:00.000Z',
  });
  if (!saved.ok) {
    throw new Error('saveFlashcard failed');
  }
  return saved.flashcardId;
}

beforeEach(() => {
  dbFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'ling93-adv-')),
    'lingobites.sqlite',
  );
  db = openFileDb();
});

afterEach(() => {
  try {
    db.close();
  } catch {
    // already closed by a restart step
  }
  resetDatabaseForTests(null);
  fs.rmSync(path.dirname(dbFile), {recursive: true, force: true});
});

describe('ADV / INV-002 real SQLite outbox atomicity (production withTransaction)', () => {
  it('ADV-H01 / INV-002: practice answer rolls back entirely when the outbox insert fails', () => {
    seedPracticeSession('adv-sess');
    db.raw.exec(`CREATE TRIGGER adv_fail_outbox BEFORE INSERT ON sync_outbox
      BEGIN SELECT RAISE(ABORT, 'ADV injected outbox failure'); END;`);

    expect(() =>
      answerCurrentQuestion({
        sessionId: 'adv-sess',
        selectedOptionId: 'q1-opt-1',
        eventId: 'adv-ev-1',
        answeredAt: '2026-09-27T10:06:00.000Z',
      }),
    ).toThrow(/ADV injected outbox failure/);

    expect(getAnswerEvents('adv-sess')).toHaveLength(0);
    expect(count('SELECT COUNT(*) AS c FROM sync_outbox')).toBe(0);
    expect(
      count(
        "SELECT current_index AS c FROM practice_sessions WHERE id = 'adv-sess'",
      ),
    ).toBe(0);
  });

  it('ADV-H02 / INV-002: review rating rolls back schedule + session when the outbox insert fails', () => {
    const cardId = seedFlashcard();
    const before = db
      .execute('SELECT * FROM review_schedule WHERE card_id = ?', [cardId])
      .rows?.item(0);
    db.raw.exec(`CREATE TRIGGER adv_fail_outbox BEFORE INSERT ON sync_outbox
      BEGIN SELECT RAISE(ABORT, 'ADV injected outbox failure'); END;`);

    expect(
      recordFlashcardRating({
        flashcardId: cardId,
        rating: 'remembered',
        reviewedAt: '2026-09-27T10:07:00.000Z',
      }),
    ).toEqual({ok: false, errorCode: 'LOCAL_DB_ERROR'});

    expect(count('SELECT COUNT(*) AS c FROM review_sessions')).toBe(0);
    expect(count('SELECT COUNT(*) AS c FROM sync_outbox')).toBe(0);
    expect(
      db
        .execute('SELECT * FROM review_schedule WHERE card_id = ?', [cardId])
        .rows?.item(0),
    ).toEqual(before);
  });

  it('ADV-H03 / INV-002: duplicate practice submit with the same event id adds no second event/outbox row', () => {
    seedPracticeSession('adv-sess');
    answerCurrentQuestion({
      sessionId: 'adv-sess',
      selectedOptionId: 'q1-opt-1',
      eventId: 'adv-ev-dup',
      answeredAt: '2026-09-27T10:06:00.000Z',
    });
    expect(() =>
      answerCurrentQuestion({
        sessionId: 'adv-sess',
        selectedOptionId: 'q2-opt-1',
        eventId: 'adv-ev-dup',
        answeredAt: '2026-09-27T10:06:01.000Z',
      }),
    ).toThrow();
    expect(count('SELECT COUNT(*) AS c FROM practice_events')).toBe(1);
    expect(count('SELECT COUNT(*) AS c FROM sync_outbox')).toBe(1);
    expect(
      count(
        "SELECT current_index AS c FROM practice_sessions WHERE id = 'adv-sess'",
      ),
    ).toBe(1);
  });
});

describe('ADV / INV-002 real SQLite + real HTTP replay (restart, unknown outcome, concurrent drain)', () => {
  let server: Server;
  beforeEach(async () => {
    server = await startServer();
  });
  afterEach(async () => {
    await server.close();
  });

  it('ADV-H04 / INV-002: pending practice+review events survive restart, lost response, retry and concurrent drains with one server effect each', async () => {
    const fetchImpl = fetchFor(server.port);
    seedPracticeSession('adv-sess');
    answerCurrentQuestion({
      sessionId: 'adv-sess',
      selectedOptionId: 'q1-opt-1',
      eventId: 'adv-ev-p1',
      answeredAt: '2026-09-27T10:06:00.000Z',
    });
    const cardId = seedFlashcard();
    recordFlashcardRating({
      flashcardId: cardId,
      rating: 'remembered',
      reviewedAt: '2026-09-27T10:07:00.000Z',
    });

    // Process kill + cold start: reopen the same SQLite file.
    db.close();
    db = openFileDb();
    const pending = listPendingSyncEvents();
    expect(pending.map(e => e.eventType).sort()).toEqual([
      'practice',
      'review',
    ]);
    const reviewId = pending.find(e => e.eventType === 'review')!.id;

    // Unknown outcome: server applies both batches, both responses are lost.
    server.dropNextResponses(2);
    const lost = await drainOutboxOnce({fetchImpl});
    expect(lost.status).toBe('failed');
    expect(listPendingSyncEvents()).toHaveLength(2);

    // Restart again before retrying.
    db.close();
    db = openFileDb();

    // Two drains race (foreground + rating-triggered).
    const outcomes = await Promise.all([
      drainOutboxOnce({fetchImpl}),
      drainOutboxOnce({fetchImpl}),
    ]);
    expect(outcomes.map(o => o.status)).toContain('synced');
    expect(listPendingSyncEvents()).toHaveLength(0);
    expect(
      count(
        "SELECT COUNT(*) AS c FROM practice_events WHERE sync_status = 'synced'",
      ),
    ).toBe(1);

    // Every delivery carried the SAME idempotency key: the server saw exactly
    // one distinct id per local operation (no fresh id per retry).
    expect([...server.effects.practice.keys()]).toEqual(['adv-ev-p1']);
    expect([...server.effects.review.keys()]).toEqual([reviewId]);
    expect(server.effects.practice.get('adv-ev-p1')).toBeGreaterThanOrEqual(2);

    await expect(drainOutboxOnce({fetchImpl})).resolves.toEqual({
      status: 'idle',
    });
  });
});
