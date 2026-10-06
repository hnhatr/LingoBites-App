import http from 'node:http';

import {open} from 'react-native-quick-sqlite';

import {DB_NAME} from '@core/db/constants';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {enqueueSyncOutboxEvent} from '@core/db/syncOutboxCore';
import type {ReviewEventPayload} from '@core/db/types';

import {CHARACTERIZATION_INVARIANTS} from '@test/support/characterization';

import {__resetMockDatabases} from '../../../../../../test-utils/sqliteMock';
import {listPendingSyncEvents} from '../../adapters/SyncOutboxRepository';
import {drainOutboxOnce} from '../../outboxSync';

const reviewPayload: ReviewEventPayload = {
  schema_version: 1,
  card_id: 'card-real-1',
  lesson_id: 'lesson-real-1',
  rating: 'remembered',
  reviewed_at: '2026-09-27T12:00:00.000Z',
  interval_days: 3,
  next_review_at: '2026-09-30T12:00:00.000Z',
};

type IdempotentServer = {
  port: number;
  close: () => Promise<void>;
  reviewPostCount: () => number;
  reviewEffectCount: () => number;
};

async function startIdempotentBatchServer(): Promise<IdempotentServer> {
  const reviewSeen = new Set<string>();
  let reviewPosts = 0;

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      if (req.url === '/v1/review-events' && req.method === 'POST') {
        reviewPosts += 1;
        const events = body.events ?? [];
        const accepted_ids: string[] = [];
        const duplicate_ids: string[] = [];
        for (const event of events) {
          if (reviewSeen.has(event.id)) {
            duplicate_ids.push(event.id);
          } else {
            reviewSeen.add(event.id);
            accepted_ids.push(event.id);
          }
        }
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(
          JSON.stringify({
            request_id: 'real-review',
            status: 'success',
            accepted: accepted_ids.length,
            duplicates: duplicate_ids.length,
            accepted_ids,
            duplicate_ids,
          }),
        );
        return;
      }
      res.writeHead(404);
      res.end();
    });
  });

  await new Promise<void>(resolve =>
    server.listen(0, '127.0.0.1', () => resolve()),
  );
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('failed to bind idempotent test server');
  }

  return {
    port: address.port,
    close: () =>
      new Promise((resolve, reject) => {
        server.close(error => (error ? reject(error) : resolve()));
      }),
    reviewPostCount: () => reviewPosts,
    reviewEffectCount: () => reviewSeen.size,
  };
}

function realFetchForPort(port: number): typeof fetch {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;
    const rewritten = url.replace(
      'http://localhost:3000',
      `http://127.0.0.1:${port}`,
    );
    return fetch(rewritten, init);
  };
}

beforeEach(() => {
  __resetMockDatabases();
  resetDatabaseForTests(open({name: DB_NAME}));
  getDatabase();
});

describe(`${CHARACTERIZATION_INVARIANTS.INV_002} real HTTP replay (HC-002)`, () => {
  it('drains review batches to a local server without duplicate server effects on retry', async () => {
    const server = await startIdempotentBatchServer();
    const fetchImpl = realFetchForPort(server.port);

    enqueueSyncOutboxEvent({
      id: 'review-real-1',
      entityId: 'card-real-1',
      payload: reviewPayload,
      createdAt: '2026-09-27T12:00:00.000Z',
    });

    const first = await drainOutboxOnce({fetchImpl});
    expect(first).toEqual({
      status: 'synced',
      syncedIds: expect.arrayContaining(['review-real-1']),
    });
    expect(listPendingSyncEvents()).toHaveLength(0);
    expect(server.reviewPostCount()).toBe(1);
    expect(server.reviewEffectCount()).toBe(1);

    // Re-enqueue the same ids to simulate a client retry after timeout.
    enqueueSyncOutboxEvent({
      id: 'review-real-1',
      entityId: 'card-real-1',
      payload: reviewPayload,
      createdAt: '2026-09-27T12:00:00.000Z',
    });

    const retry = await drainOutboxOnce({fetchImpl});
    expect(retry.status).toBe('synced');
    expect(server.reviewPostCount()).toBe(2);
    expect(server.reviewEffectCount()).toBe(1);

    await server.close();
  });
});
