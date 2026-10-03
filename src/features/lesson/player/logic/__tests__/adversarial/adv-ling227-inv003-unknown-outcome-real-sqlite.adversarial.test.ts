import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import {listPendingSyncEvents} from '@features/sync/logic/adapters/SyncOutboxRepository';
import {drainOutboxOnce} from '@features/sync/logic/outboxSync';

import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import type {SyncPushMutation} from '@core/schemas/sync';
import {getLessonProgress, recordLessonEvent} from '@core/sync/lessonProgress';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

const LESSON_ID = '33333333-3333-4333-8333-333333333327';
const EVENT_ID = '44444444-4444-4444-8444-444444444427';
const COMPLETED_AT = '2026-10-03T12:00:00.000Z';

type UnknownOutcomeServer = {
  port: number;
  observedIds: string[];
  close: () => Promise<void>;
};

async function startUnknownOutcomeServer(): Promise<UnknownOutcomeServer> {
  const observedIds: string[] = [];
  let requestCount = 0;
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      const mutations = (body.mutations ?? []) as SyncPushMutation[];
      observedIds.push(...mutations.map(mutation => mutation.mutation_id));
      requestCount += 1;

      if (requestCount === 1) {
        // Model a server commit followed by a lost response: the client cannot
        // know whether the mutation was accepted and must keep it for retry.
        req.socket.destroy();
        return;
      }

      const results = mutations.map(mutation => ({
        mutation_id: mutation.mutation_id,
        collection: mutation.collection,
        entity_id: mutation.entity_id,
        status: 'duplicate',
        revision: 1,
      }));
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(
        JSON.stringify({
          request_id: '00000000-0000-4000-8000-000000000027',
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
    throw new Error('failed to bind unknown-outcome server');
  }
  return {
    port: address.port,
    observedIds,
    close: () =>
      new Promise(resolve => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
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

describe('LING-227 INV-003 retry after an unknown push outcome', () => {
  let dbFile: string;
  let db: RealSqliteConnection;
  let server: UnknownOutcomeServer | undefined;

  function openFileDb(): RealSqliteConnection {
    const connection = openRealSqlite(dbFile);
    resetDatabaseForTests(connection);
    runMigrations(connection);
    return connection;
  }

  beforeEach(() => {
    dbFile = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'ling227-unknown-outcome-')),
      'lingobites.sqlite',
    );
    db = openFileDb();
  });

  afterEach(async () => {
    await server?.close();
    try {
      db.close();
    } catch {
      // The restart step may already have closed this handle.
    }
    resetDatabaseForTests(null);
    fs.rmSync(path.dirname(dbFile), {recursive: true, force: true});
  });

  it('ADV-H001 / INV-003: response loss, restart, and duplicate retry preserve the completion', async () => {
    server = await startUnknownOutcomeServer();
    const fetchImpl = fetchFor(server.port);
    expect(
      recordLessonEvent({
        lessonId: LESSON_ID,
        event: 'complete',
        occurredAt: COMPLETED_AT,
        eventId: EVENT_ID,
      }),
    ).toMatchObject({ok: true, status: 'completed'});

    await expect(drainOutboxOnce({fetchImpl})).resolves.toMatchObject({
      status: 'failed',
      errorCode: 'NETWORK_ERROR',
      retryable: true,
    });
    expect(listPendingSyncEvents().map(event => event.id)).toEqual([EVENT_ID]);
    expect(getLessonProgress(LESSON_ID)).toMatchObject({
      status: 'completed',
      completedAt: COMPLETED_AT,
    });

    db.close();
    db = openFileDb();
    expect(listPendingSyncEvents().map(event => event.id)).toEqual([EVENT_ID]);
    expect(getLessonProgress(LESSON_ID)?.status).toBe('completed');

    await expect(
      drainOutboxOnce({fetchImpl, includeStuck: true}),
    ).resolves.toEqual({status: 'synced', syncedIds: [EVENT_ID]});
    expect(listPendingSyncEvents()).toEqual([]);
    expect(getLessonProgress(LESSON_ID)).toMatchObject({
      status: 'completed',
      completedAt: COMPLETED_AT,
    });
    expect(server.observedIds).toEqual([EVENT_ID, EVENT_ID]);
  });
});
