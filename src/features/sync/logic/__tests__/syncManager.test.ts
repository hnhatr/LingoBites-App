import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {open} from 'react-native-quick-sqlite';
import {getDatabase, resetDatabaseForTests} from '@shared/db/database';
import {DB_NAME} from '@shared/db/constants';
import {enqueueSyncOutboxEvent} from '@shared/db/syncOutboxCore';
import {listPendingSyncEvents} from '../adapters/SyncOutboxRepository';
import type {ReviewEventPayload} from '@shared/db/types';
import {getSyncOutboxStatus} from '../outboxSync';
import {createSyncManager} from '../syncManager';
import {MAX_SYNC_ATTEMPTS, syncRetryDelayMs} from '../syncPolicy';

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

function seedEvent(id: string) {
  enqueueSyncOutboxEvent({id, entityId: 'card-1', payload});
}

const response = (
  body: unknown,
  options: {ok?: boolean; status?: number} = {},
) => ({
  ok: options.ok ?? true,
  status: options.status ?? 200,
  json: jest.fn().mockResolvedValue(body),
});

const successBody = (ids: string[]) => ({
  request_id: 'server-req',
  status: 'success',
  accepted: ids.length,
  duplicates: 0,
  accepted_ids: ids,
  duplicate_ids: [],
});

async function flush() {
  await jest.advanceTimersByTimeAsync(0);
}

describe('createSyncManager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    getDatabase();
    mockFetch.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('drains pending events on start and idles afterwards', async () => {
    seedEvent('event-1');
    mockFetch.mockResolvedValueOnce(response(successBody(['event-1'])));

    const manager = createSyncManager({fetchImpl: mockFetch as never});
    manager.start();
    await flush();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(listPendingSyncEvents()).toHaveLength(0);

    // Requesting again with nothing pending does not hit the network.
    manager.requestSync();
    await flush();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not run before start()', async () => {
    seedEvent('event-1');
    mockFetch.mockResolvedValueOnce(response(successBody(['event-1'])));

    const manager = createSyncManager({fetchImpl: mockFetch as never});
    manager.requestSync();
    await flush();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(listPendingSyncEvents()).toHaveLength(1);

    manager.start();
    await flush();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries a failed drain after the exponential backoff and then syncs', async () => {
    seedEvent('event-1');
    mockFetch
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(response(successBody(['event-1'])));

    const manager = createSyncManager({
      fetchImpl: mockFetch as never,
      randomFn: () => 1,
    });
    manager.start();
    await flush();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(listPendingSyncEvents()[0].attemptCount).toBe(1);

    // Not yet past the backoff window: no retry.
    await jest.advanceTimersByTimeAsync(9_999);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Crossing the backoff window fires the retry and clears the queue.
    await jest.advanceTimersByTimeAsync(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(listPendingSyncEvents()).toHaveLength(0);
  });

  it('schedules retry with jitter at boundary randomFn values', async () => {
    const nextAttempt = 2;
    const base = syncRetryDelayMs(nextAttempt);
    const minDelayMs = Math.floor(base / 2);

    for (const [randomFn, delayMs] of [
      [() => 0, minDelayMs],
      [() => 1, base],
    ] as const) {
      __resetMockDatabases();
      resetDatabaseForTests(open({name: DB_NAME}));
      getDatabase();
      mockFetch.mockReset();
      seedEvent('event-1');
      mockFetch
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce(response(successBody(['event-1'])));

      const manager = createSyncManager({
        fetchImpl: mockFetch as never,
        randomFn,
      });
      manager.start();
      await flush();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(delayMs - 1);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      manager.stop();
    }
  });

  it('requestSync cancels a pending backoff and drains immediately (network returned)', async () => {
    seedEvent('event-1');
    mockFetch
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(response(successBody(['event-1'])));

    const manager = createSyncManager({fetchImpl: mockFetch as never});
    manager.start();
    await flush();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    manager.requestSync();
    await flush();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(listPendingSyncEvents()).toHaveLength(0);
  });

  it('does not auto-retry a non-retryable rejection', async () => {
    seedEvent('event-1');
    mockFetch.mockResolvedValue(
      response(
        {
          request_id: 'r',
          status: 'failed',
          error: {code: 'VALIDATION_REVIEW_EVENTS', message: 'bad payload'},
        },
        {ok: false, status: 400},
      ),
    );

    const manager = createSyncManager({fetchImpl: mockFetch as never});
    manager.start();
    await flush();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(10 * 60_000);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(listPendingSyncEvents()[0].attemptCount).toBe(1);
  });

  it('stops retrying once rows hit the attempt cap (no infinite storm)', async () => {
    seedEvent('event-1');
    mockFetch.mockRejectedValue(new Error('offline'));

    const manager = createSyncManager({fetchImpl: mockFetch as never});
    manager.start();
    await flush();

    for (let index = 0; index < MAX_SYNC_ATTEMPTS + 4; index += 1) {
      await jest.advanceTimersByTimeAsync(10 * 60_000);
    }

    expect(mockFetch).toHaveBeenCalledTimes(MAX_SYNC_ATTEMPTS);
    expect(getSyncOutboxStatus()).toEqual({pending: 1, stuck: 1});
  });

  it('an explicit requestSync still drains rows that reached the cap (reconnect)', async () => {
    seedEvent('event-1');
    mockFetch.mockRejectedValue(new Error('offline'));

    const manager = createSyncManager({fetchImpl: mockFetch as never});
    manager.start();
    await flush();

    // Drive the row to the attempt cap through automatic backoff retries.
    for (let index = 0; index < MAX_SYNC_ATTEMPTS + 2; index += 1) {
      await jest.advanceTimersByTimeAsync(10 * 60_000);
    }
    expect(mockFetch).toHaveBeenCalledTimes(MAX_SYNC_ATTEMPTS);
    expect(getSyncOutboxStatus()).toEqual({pending: 1, stuck: 1});

    // Network returns and the app foregrounds -> explicit trigger drains.
    mockFetch.mockResolvedValueOnce(response(successBody(['event-1'])));
    manager.requestSync();
    await flush();

    expect(mockFetch).toHaveBeenCalledTimes(MAX_SYNC_ATTEMPTS + 1);
    expect(listPendingSyncEvents()).toHaveLength(0);
    expect(getSyncOutboxStatus()).toEqual({pending: 0, stuck: 0});
  });

  it('stop() during a pending fetch prevents retries if the drain fails', async () => {
    seedEvent('event-1');
    let rejectFetch: (err: any) => void;
    const fetchPromise = new Promise((_, rej) => {
      rejectFetch = rej;
    });
    mockFetch.mockReturnValueOnce(fetchPromise);

    const manager = createSyncManager({fetchImpl: mockFetch as never});
    manager.start();
    await flush();

    expect(mockFetch).toHaveBeenCalledTimes(1);

    manager.stop();
    rejectFetch!(new Error('offline'));
    await flush();

    await jest.advanceTimersByTimeAsync(10 * 60_000);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('stop() during a pending fetch prevents further drains if the drain succeeds but rows remain', async () => {
    seedEvent('event-1');
    seedEvent('event-2');

    let resolveFetch: (res: any) => void;
    const fetchPromise = new Promise(res => {
      resolveFetch = res;
    });
    mockFetch.mockReturnValueOnce(fetchPromise);

    const manager = createSyncManager({fetchImpl: mockFetch as never});
    manager.start();
    await flush();

    expect(mockFetch).toHaveBeenCalledTimes(1);

    manager.stop();

    // event-1 is resolved, but event-2 remains pending
    resolveFetch!(response(successBody(['event-1'])));
    await flush();

    // The manager should not have triggered a second network call for event-2
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(listPendingSyncEvents()).toHaveLength(1);
  });

  it('re-starting after a stop works correctly and is not affected by stale run', async () => {
    seedEvent('event-1');
    let rejectFetch: (err: any) => void;
    const fetchPromise1 = new Promise((_, rej) => {
      rejectFetch = rej;
    });
    mockFetch.mockReturnValueOnce(fetchPromise1);

    const manager = createSyncManager({fetchImpl: mockFetch as never});
    manager.start();
    await flush();

    expect(mockFetch).toHaveBeenCalledTimes(1);

    manager.stop();
    manager.start();

    // still waiting on first fetch, so start() buffered a new request
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // mock the second fetch
    mockFetch.mockResolvedValueOnce(response(successBody(['event-1'])));

    // finish the first fetch (fails)
    rejectFetch!(new Error('offline'));
    await flush();

    // it should immediately trigger the buffered request and resolve it
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(listPendingSyncEvents()).toHaveLength(0);
  });
});
