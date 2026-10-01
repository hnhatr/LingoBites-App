import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {enqueueSyncOutboxEvent} from '@core/db/syncOutboxCore';
import type {SyncPushMutation} from '@core/schemas/sync';
import {
  getLessonProgress,
  recordLessonEvent,
} from '@core/sync/lessonProgress';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

import {
  listPendingSyncEvents,
  markSyncEventsFailed,
} from '../../adapters/SyncOutboxRepository';
import {drainOutboxOnce} from '../../outboxSync';
import {applySyncRecord} from '../../pullWorker';

/**
 * LING-172 (TASK-006): `lesson_progress` sync on real SQLite + real HTTP
 * (INV-001 App half, INV-003). The stub server speaks sync v2: a
 * well-formed `lesson_progress` batch is always accepted, while a batch
 * carrying an invalid flashcard mutation is rejected 400 — proving the
 * progress batch cannot be blocked by another collection.
 */

const START_ID = '33333333-3333-4333-8333-333333333331';
const COMPLETE_ID = '33333333-3333-4333-8333-333333333332';
const FLASH_ID = '33333333-3333-4333-8333-333333333333';
const BAD_PROGRESS_ID = '33333333-3333-4333-8333-333333333334';
const T1 = '2026-10-01T10:00:00.000Z';
const T2 = '2026-10-01T10:05:00.000Z';

type PushServer = {
  port: number;
  close: () => Promise<void>;
  batches: Array<{collections: string[]}>;
  accepted: string[];
};

async function startPushServer(): Promise<PushServer> {
  const batches: Array<{collections: string[]}> = [];
  const accepted: string[] = [];
  let requestSeq = 0;
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      if (req.url !== '/v1/sync/push' || req.method !== 'POST') {
        res.writeHead(404);
        res.end();
        return;
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      const mutations = (body.mutations ?? []) as SyncPushMutation[];
      batches.push({
        collections: [...new Set(mutations.map(m => m.collection))],
      });
      const invalid = mutations.find(
        m =>
          (m.payload as {invalid?: unknown} | undefined)?.invalid === true,
      );
      if (invalid) {
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(
          JSON.stringify({
            status: 'failed',
            error: {code: 'VALIDATION_SYNC'},
          }),
        );
        return;
      }
      requestSeq += 1;
      const results = mutations.map(m => {
        accepted.push(m.mutation_id);
        return {
          mutation_id: m.mutation_id,
          collection: m.collection,
          entity_id: m.entity_id,
          status: 'applied',
          revision: 7,
        };
      });
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(
        JSON.stringify({
          request_id: `00000000-0000-4000-8000-${String(requestSeq).padStart(
            12,
            '0',
          )}`,
          status: 'success',
          contract_version: 2,
          results,
        }),
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
    batches,
    accepted,
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
let server: PushServer;

function openFileDb(): RealSqliteConnection {
  const connection = openRealSqlite(dbFile);
  resetDatabaseForTests(connection);
  runMigrations(connection);
  return connection;
}

function pendingIds(): string[] {
  return listPendingSyncEvents().map(e => e.id);
}

beforeEach(async () => {
  dbFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'ling172-sync-')),
    'lingobites.sqlite',
  );
  db = openFileDb();
  server = await startPushServer();
});

afterEach(async () => {
  await server.close();
  try {
    db.close();
  } catch {
    // already closed by a restart step
  }
  resetDatabaseForTests(null);
  fs.rmSync(path.dirname(dbFile), {recursive: true, force: true});
});

describe('ADV / LING-172 lesson_progress push on real SQLite + HTTP', () => {
  it('an invalid flashcard mutation in a mixed queue cannot block lesson_progress', async () => {
    const fetchImpl = fetchFor(server.port);
    recordLessonEvent({
      lessonId: 'lesson-mixed',
      event: 'start',
      occurredAt: T1,
      eventId: START_ID,
    });
    enqueueSyncOutboxEvent({
      id: FLASH_ID,
      eventType: 'flashcards',
      entityId: 'card-bad',
      payload: {invalid: true},
      createdAt: T1,
    });

    const outcome = await drainOutboxOnce({fetchImpl});

    expect(outcome.status).toBe('synced');
    // Progress traveled in its own batch and was accepted.
    expect(server.batches).toEqual([
      {collections: ['lesson_progress']},
      {collections: ['flashcards']},
    ]);
    expect(server.accepted).toEqual([START_ID]);
    // Progress left the outbox; the invalid row stays pending for inspection.
    expect(pendingIds()).toEqual([FLASH_ID]);
    expect(getLessonProgress('lesson-mixed')).toMatchObject({
      status: 'in_progress',
    });
  });

  it('a malformed lesson_progress row fails closed without blocking the valid batch', async () => {
    const fetchImpl = fetchFor(server.port);
    recordLessonEvent({
      lessonId: 'lesson-good',
      event: 'complete',
      occurredAt: T1,
      eventId: COMPLETE_ID,
    });
    // DEV-002 violation injected locally: must never reach the server.
    enqueueSyncOutboxEvent({
      id: BAD_PROGRESS_ID,
      eventType: 'lesson_progress',
      entityId: 'lesson-bad',
      payload: {tombstone: true},
      createdAt: T1,
    });

    const outcome = await drainOutboxOnce({fetchImpl});

    expect(outcome.status).toBe('synced');
    expect(server.batches).toEqual([{collections: ['lesson_progress']}]);
    expect(server.accepted).toEqual([COMPLETE_ID]);
    expect(pendingIds()).toEqual([BAD_PROGRESS_ID]);
  });

  it('stuck rows are retried through an explicit sync request', async () => {
    const fetchImpl = fetchFor(server.port);
    recordLessonEvent({
      lessonId: 'lesson-stuck',
      event: 'start',
      occurredAt: T1,
      eventId: START_ID,
    });

    // Reach the attempt cap: the automatic drain leaves the row alone.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      markSyncEventsFailed([START_ID], 'OFFLINE');
    }
    const auto = await drainOutboxOnce({fetchImpl});
    expect(auto).toEqual({status: 'stuck'});
    expect(pendingIds()).toEqual([START_ID]);

    // An explicit requestSync-style drain retries stuck rows.
    const requested = await drainOutboxOnce({fetchImpl, includeStuck: true});
    expect(requested).toEqual({status: 'synced', syncedIds: [START_ID]});
    expect(pendingIds()).toEqual([]);
  });

  it('queued events survive restart and drain (AC-010 S7)', async () => {
    const fetchImpl = fetchFor(server.port);
    recordLessonEvent({
      lessonId: 'lesson-restart',
      event: 'start',
      occurredAt: T1,
      eventId: START_ID,
    });
    recordLessonEvent({
      lessonId: 'lesson-restart',
      event: 'complete',
      occurredAt: T2,
      eventId: COMPLETE_ID,
    });

    db.close();
    db = openFileDb();
    expect(pendingIds()).toEqual([START_ID, COMPLETE_ID]);

    const outcome = await drainOutboxOnce({fetchImpl});
    expect(outcome).toEqual({
      status: 'synced',
      syncedIds: expect.arrayContaining([START_ID, COMPLETE_ID]),
    });
    expect(pendingIds()).toEqual([]);
  });
});

describe('ADV / LING-172 lesson_progress pull rank on real SQLite', () => {
  it('a lower-rank pull never overwrites a higher local rank (INV-001)', () => {
    recordLessonEvent({
      lessonId: 'lesson-rank',
      event: 'start',
      occurredAt: T1,
      eventId: START_ID,
    });
    recordLessonEvent({
      lessonId: 'lesson-rank',
      event: 'complete',
      occurredAt: T2,
      eventId: COMPLETE_ID,
    });

    // A stale in_progress pull with a HIGHER revision must not regress.
    applySyncRecord({
      collection: 'lesson_progress',
      entity_id: 'lesson-rank',
      payload: {
        status: 'in_progress',
        started_at: T1,
        completed_at: null,
      },
      revision: 99,
      occurred_at: T2,
      updated_at: T2,
      tombstone: false,
    });

    expect(getLessonProgress('lesson-rank')).toMatchObject({
      status: 'completed',
      startedAt: T1,
      completedAt: T2,
    });
  });

  it('an advancing pull replaces local state with server times', () => {
    recordLessonEvent({
      lessonId: 'lesson-advance',
      event: 'start',
      occurredAt: T1,
      eventId: START_ID,
    });

    applySyncRecord({
      collection: 'lesson_progress',
      entity_id: 'lesson-advance',
      payload: {
        status: 'completed',
        started_at: '2026-10-01T09:00:00.000Z',
        completed_at: T2,
      },
      revision: 5,
      occurred_at: T2,
      updated_at: T2,
      tombstone: false,
    });

    expect(getLessonProgress('lesson-advance')).toMatchObject({
      status: 'completed',
      startedAt: '2026-10-01T09:00:00.000Z',
      completedAt: T2,
      revision: 5,
    });
  });

  it('a tombstoned lesson_progress pull is ignored, never a regression', () => {
    recordLessonEvent({
      lessonId: 'lesson-tomb',
      event: 'complete',
      occurredAt: T1,
      eventId: COMPLETE_ID,
    });

    applySyncRecord({
      collection: 'lesson_progress',
      entity_id: 'lesson-tomb',
      payload: {
        status: 'completed',
        started_at: T1,
        completed_at: T1,
      },
      revision: 50,
      occurred_at: T2,
      updated_at: T2,
      tombstone: true,
    });

    expect(getLessonProgress('lesson-tomb')).toMatchObject({
      status: 'completed',
    });
  });

  it('an unknown pulled collection does not throw or stall', () => {
    expect(() =>
      applySyncRecord({
        collection: 'some_future_collection',
        entity_id: 'x',
        payload: {},
        revision: 1,
        occurred_at: T1,
        updated_at: T1,
        tombstone: false,
      }),
    ).not.toThrow();
  });

  it('a malformed lesson_progress payload fails loudly', () => {
    expect(() =>
      applySyncRecord({
        collection: 'lesson_progress',
        entity_id: 'lesson-malformed',
        payload: {status: 'bogus'},
        revision: 1,
        occurred_at: T1,
        updated_at: T1,
        tombstone: false,
      }),
    ).toThrow(/Invalid lesson_progress payload/);
  });
});
