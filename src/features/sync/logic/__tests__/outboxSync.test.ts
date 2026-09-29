import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {open} from 'react-native-quick-sqlite';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {DB_NAME} from '@core/db/constants';
import {enqueueSyncOutboxEvent} from '@core/db/syncOutboxCore';
import {
  listPendingSyncEvents,
  markSyncEventsFailed,
} from '../adapters/SyncOutboxRepository';
import type {ReviewEventPayload} from '@core/db/types';
import {drainOutboxOnce, getSyncOutboxStatus} from '../outboxSync';
import {MAX_SYNC_ATTEMPTS} from '../syncPolicy';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const payload: ReviewEventPayload = {
  schema_version: 1,
  card_id: 'card-1',
  lesson_id: 'lesson-1',
  rating: 'remembered',
  reviewed_at: '2026-09-05T12:00:00.000Z',
  interval_days: 7,
  next_review_at: '2026-09-12T12:00:00.000Z',
};

function seedEvent(id: string, createdAt = '2026-09-05T12:00:00.000Z') {
  enqueueSyncOutboxEvent({id, entityId: 'card-1', payload, createdAt});
}

function successBody(ids: string[]) {
  return {
    request_id: 'server-req',
    status: 'success',
    accepted: ids.length,
    duplicates: 0,
    accepted_ids: ids,
    duplicate_ids: [],
  };
}

const response = (
  body: unknown,
  options: {ok?: boolean; status?: number} = {},
) => ({
  ok: options.ok ?? true,
  status: options.status ?? 200,
  json: jest.fn().mockResolvedValue(body),
});

beforeEach(() => {
  __resetMockDatabases();
  resetDatabaseForTests(open({name: DB_NAME}));
  getDatabase();
  mockFetch.mockReset();
});

describe('drainOutboxOnce', () => {
  it('is idle when there is nothing pending', async () => {
    await expect(drainOutboxOnce()).resolves.toEqual({status: 'idle'});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends pending events and marks them synced', async () => {
    seedEvent('event-1');
    seedEvent('event-2', '2026-09-05T13:00:00.000Z');
    mockFetch.mockResolvedValueOnce(
      response(successBody(['event-1', 'event-2'])),
    );

    const outcome = await drainOutboxOnce();

    expect(outcome).toEqual({
      status: 'synced',
      syncedIds: ['event-1', 'event-2'],
    });
    expect(listPendingSyncEvents()).toHaveLength(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/v1/review-events');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      events: [
        {
          id: 'event-1',
          event_type: 'review',
          entity_id: 'card-1',
          payload,
          created_at: '2026-09-05T12:00:00.000Z',
        },
        {
          id: 'event-2',
          event_type: 'review',
          entity_id: 'card-1',
          payload,
          created_at: '2026-09-05T13:00:00.000Z',
        },
      ],
    });
  });

  it('draining an already-synced batch is a no-op, so the server sees each event once (VC-3)', async () => {
    seedEvent('event-1');
    mockFetch.mockResolvedValueOnce(response(successBody(['event-1'])));

    await drainOutboxOnce();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Re-running the drain against the synced batch must not resend anything.
    const replay = await drainOutboxOnce();
    expect(replay).toEqual({status: 'idle'});
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('marks server-reported duplicates as synced too', async () => {
    seedEvent('event-1');
    mockFetch.mockResolvedValueOnce(
      response({
        request_id: 'server-req',
        status: 'success',
        accepted: 0,
        duplicates: 1,
        accepted_ids: [],
        duplicate_ids: ['event-1'],
      }),
    );

    await expect(drainOutboxOnce()).resolves.toEqual({
      status: 'synced',
      syncedIds: ['event-1'],
    });
    expect(listPendingSyncEvents()).toHaveLength(0);
  });

  it('records a failed drain as an attempt with the error and stays pending', async () => {
    seedEvent('event-1');
    mockFetch.mockRejectedValueOnce(new Error('network down'));

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
    expect(pending[0].lastError).not.toBeNull();
    expect(pending[0].syncedAt).toBeNull();
  });

  it('does not attempt rows that reached the attempt cap and reports stuck', async () => {
    seedEvent('event-stuck');
    for (let attempt = 0; attempt < MAX_SYNC_ATTEMPTS; attempt += 1) {
      markSyncEventsFailed(['event-stuck'], 'network down');
    }

    const outcome = await drainOutboxOnce();

    expect(outcome).toEqual({status: 'stuck'});
    expect(mockFetch).not.toHaveBeenCalled();
    expect(getSyncOutboxStatus()).toEqual({pending: 1, stuck: 1});
  });
});
