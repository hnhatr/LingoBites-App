import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {saveContentLesson} from '@features/lesson/packages/logic/data/ContentLessonStateRepository';
import {listPendingSyncEvents} from '../../adapters/SyncOutboxRepository';
import {drainOutboxOnce} from '../../outboxSync';
import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

/**
 * LING-97 adversarial review (INV-002, TASK-004 generic drain path). A generic
 * collection event (`content_lesson_state`) is drained by the production
 * `drainOutboxOnce` → sync-owned `syncClient.syncPush` → sync-owned outbox
 * adapter, on a real SQLite file and a real local HTTP server that applies each
 * `mutation_id` once. Failure is injected only at the transport boundary
 * (HTTP 503, response dropped after the server applied the batch).
 */

type PushServer = {
  port: number;
  close: () => Promise<void>;
  /** mutation_id → number of deliveries received. */
  deliveries: Map<string, number>;
  /** mutation_ids whose effect the server applied (at most once each). */
  applied: Set<string>;
  failNext: (mode: '503' | 'drop', times: number) => void;
};

async function startPushServer(): Promise<PushServer> {
  const deliveries = new Map<string, number>();
  const applied = new Set<string>();
  let mode: '503' | 'drop' | null = null;
  let remaining = 0;
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
      if (remaining > 0 && mode === '503') {
        remaining -= 1;
        res.writeHead(503, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({status: 'failed'}));
        return;
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      const results = (body.mutations ?? []).map(
        (m: {mutation_id: string; collection: string; entity_id: string}) => {
          deliveries.set(
            m.mutation_id,
            (deliveries.get(m.mutation_id) ?? 0) + 1,
          );
          const duplicate = applied.has(m.mutation_id);
          applied.add(m.mutation_id);
          return {
            mutation_id: m.mutation_id,
            collection: m.collection,
            entity_id: m.entity_id,
            status: duplicate ? 'duplicate' : 'applied',
            revision: 1,
          };
        },
      );
      if (remaining > 0 && mode === 'drop') {
        remaining -= 1;
        // Unknown outcome: effect committed server-side, response lost.
        req.socket.destroy();
        return;
      }
      requestSeq += 1;
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(
        JSON.stringify({
          request_id: `00000000-0000-4000-8000-${String(requestSeq).padStart(
            12,
            '0',
          )}`,
          status: 'success',
          contract_version: 1,
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
    deliveries,
    applied,
    failNext: (m, times) => {
      mode = m;
      remaining = times;
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
let server: PushServer;

function openFileDb(): RealSqliteConnection {
  const connection = openRealSqlite(dbFile);
  resetDatabaseForTests(connection);
  runMigrations(connection);
  return connection;
}

beforeEach(async () => {
  dbFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'ling97-adv-')),
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

describe('ADV / INV-002 generic sync drain (sync-owned adapter + syncClient) on real SQLite + HTTP', () => {
  it('ADV-H08 / INV-002: a generic event survives 503 and a dropped response across restart, replays with the same mutation_id, and is applied once', async () => {
    const fetchImpl = fetchFor(server.port);
    saveContentLesson({
      lessonId: 'content-g1',
      now: '2026-09-28T01:00:00.000Z',
    });
    const [event] = listPendingSyncEvents();
    expect(event).toMatchObject({eventType: 'content_lesson_state'});

    // Definite failure: 503 before any effect.
    server.failNext('503', 1);
    const unavailable = await drainOutboxOnce({fetchImpl});
    expect(unavailable).toMatchObject({status: 'failed', retryable: true});
    expect(listPendingSyncEvents().map(e => e.id)).toEqual([event.id]);
    expect(server.applied.size).toBe(0);

    // Unknown outcome: server applies, response is lost.
    server.failNext('drop', 1);
    const lost = await drainOutboxOnce({fetchImpl});
    expect(lost).toMatchObject({status: 'failed', retryable: true});
    expect(listPendingSyncEvents().map(e => e.id)).toEqual([event.id]);
    expect(server.applied.has(event.id)).toBe(true);

    // Process kill + cold start before the retry.
    db.close();
    db = openFileDb();
    expect(listPendingSyncEvents()).toEqual([
      expect.objectContaining({id: event.id, attemptCount: 2, syncedAt: null}),
    ]);

    const retried = await drainOutboxOnce({fetchImpl});
    expect(retried).toEqual({status: 'synced', syncedIds: [event.id]});
    expect(listPendingSyncEvents()).toEqual([]);

    // One idempotency key end to end; effect applied exactly once.
    expect([...server.deliveries.keys()]).toEqual([event.id]);
    expect(server.deliveries.get(event.id)).toBe(2);
    expect(server.applied.size).toBe(1);

    await expect(drainOutboxOnce({fetchImpl})).resolves.toEqual({
      status: 'idle',
    });
  });
});
