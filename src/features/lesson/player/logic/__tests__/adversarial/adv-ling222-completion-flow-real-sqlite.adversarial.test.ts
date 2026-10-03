import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import {
  listPendingSyncEvents,
  markSyncEventsFailed,
} from '@features/sync/logic/adapters/SyncOutboxRepository';
import {drainOutboxOnce} from '@features/sync/logic/outboxSync';

import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import type {SyncPushMutation} from '@core/schemas/sync';
import {getLessonProgress, recordLessonEvent} from '@core/sync/lessonProgress';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

/**
 * LING-222 TASK-003 (INV-003): hub completion rows and outbox events survive
 * push failure, restart, and later successful sync on real SQLite.
 */

const LESSON_ID = '33333333-3333-4333-8333-333333333331';
const EVENT_ID = '44444444-4444-4444-8444-444444444441';
const T1 = '2026-10-06T10:00:00.000Z';

type PushServer = {
  port: number;
  close: () => Promise<void>;
  accepted: string[];
};

async function startPushServer(
  handler: (mutations: SyncPushMutation[]) => number,
): Promise<PushServer> {
  const accepted: string[] = [];
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
      const status = handler(mutations);
      if (status !== 200) {
        res.writeHead(status, {'Content-Type': 'application/json'});
        res.end(
          JSON.stringify({status: 'failed', error: {code: 'SERVER_ERROR'}}),
        );
        return;
      }
      const results = mutations.map(m => {
        accepted.push(m.mutation_id);
        return {
          mutation_id: m.mutation_id,
          collection: m.collection,
          entity_id: m.entity_id,
          status: 'applied',
          revision: 1,
        };
      });
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(
        JSON.stringify({
          request_id: '00000000-0000-4000-8000-000000000001',
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
    throw new Error('failed to bind push server');
  }
  return {
    port: address.port,
    close: () =>
      new Promise(resolve => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
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

function openFileDb(): RealSqliteConnection {
  const connection = openRealSqlite(dbFile);
  resetDatabaseForTests(connection);
  runMigrations(connection);
  return connection;
}

function pendingIds(): string[] {
  return listPendingSyncEvents().map(event => event.id);
}

beforeEach(() => {
  dbFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'ling222-completion-')),
    'lingobites.sqlite',
  );
  db = openFileDb();
});

afterEach(() => {
  try {
    db.close();
  } catch {
    // closed by restart step
  }
  resetDatabaseForTests(null);
  fs.rmSync(path.dirname(dbFile), {recursive: true, force: true});
});

describe('ADV / LING-222 completion flow INV-003 on real SQLite', () => {
  it('AC-004 S3: finished lesson keeps a queued event after push failure and restart', async () => {
    const server = await startPushServer(() => 503);
    const fetchImpl = fetchFor(server.port);
    const recorded = recordLessonEvent({
      lessonId: LESSON_ID,
      event: 'complete',
      occurredAt: T1,
      eventId: EVENT_ID,
    });
    expect(recorded).toMatchObject({ok: true, status: 'completed'});
    expect(pendingIds()).toEqual([EVENT_ID]);

    const failed = await drainOutboxOnce({fetchImpl});
    expect(failed.status).toBe('failed');
    expect(pendingIds()).toEqual([EVENT_ID]);
    expect(getLessonProgress(LESSON_ID)).toMatchObject({
      status: 'completed',
      completedAt: T1,
    });

    db.close();
    db = openFileDb();
    expect(getLessonProgress(LESSON_ID)).toMatchObject({status: 'completed'});
    expect(pendingIds()).toEqual([EVENT_ID]);
    await server.close();
  });

  it('AC-004 S4: a successful push clears the queue while the lesson stays finished', async () => {
    const server = await startPushServer(() => 200);
    const fetchImpl = fetchFor(server.port);
    recordLessonEvent({
      lessonId: LESSON_ID,
      event: 'complete',
      occurredAt: T1,
      eventId: EVENT_ID,
    });
    markSyncEventsFailed([EVENT_ID], 'OFFLINE');

    const outcome = await drainOutboxOnce({fetchImpl, includeStuck: true});
    expect(outcome).toEqual({status: 'synced', syncedIds: [EVENT_ID]});
    expect(pendingIds()).toEqual([]);
    expect(getLessonProgress(LESSON_ID)).toMatchObject({
      status: 'completed',
      completedAt: T1,
    });
    expect(server.accepted).toEqual([EVENT_ID]);
    await server.close();
  });
});
