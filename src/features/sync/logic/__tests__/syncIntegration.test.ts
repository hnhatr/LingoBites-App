/* eslint-disable @typescript-eslint/no-unused-vars */
import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {getDatabase, resetDatabaseForTests} from '@shared/db/database';
import {enqueueSyncOutboxEvent} from '@shared/db/syncOutboxCore';
import {listPendingSyncEvents} from '../adapters/SyncOutboxRepository';
import {getSyncOutboxStatus} from '../outboxSync';
import {createSyncManager} from '../syncManager';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

async function flush() {
  await jest.advanceTimersByTimeAsync(0);
}

describe('Sync Integration', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests();
    mockFetch.mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sync refresh race (parallel push + pull)', async () => {
    enqueueSyncOutboxEvent({id: 'push-1', entityId: 'e1', payload: {}});
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        request_id: 'push-req',
        status: 'success',
        accepted: 1,
        duplicates: 0,
        accepted_ids: ['push-1'],
        duplicate_ids: [],
        server_updates: [{id: 'pull-1', payload: {}}],
      }),
    });

    const manager = createSyncManager({fetchImpl: mockFetch});
    manager.start();
    await flush();

    const status = getSyncOutboxStatus();
    expect(status.pending).toBe(0);
    manager.stop();
  });

  it('duplicate/out-of-order mutation convergence', async () => {
    enqueueSyncOutboxEvent({id: 'dup-1', entityId: 'e2', payload: {}});

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        request_id: 'push-req',
        status: 'success',
        accepted: 1,
        duplicates: 1,
        accepted_ids: ['dup-1'],
        duplicate_ids: ['dup-1'],
      }),
    });

    const manager = createSyncManager({fetchImpl: mockFetch});
    manager.start();
    await flush();

    const status = getSyncOutboxStatus();
    expect(status.pending).toBe(0);
    manager.stop();
  });

  it('offline enqueue then boot/foreground retry convergence', async () => {
    enqueueSyncOutboxEvent({id: 'off-1', entityId: 'e3', payload: {}});

    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const manager = createSyncManager({fetchImpl: mockFetch});
    manager.start();
    await flush();

    let status = getSyncOutboxStatus();
    expect(status.pending).toBe(1);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        request_id: 'push-req',
        status: 'success',
        accepted: 1,
        duplicates: 0,
        accepted_ids: ['off-1'],
        duplicate_ids: [],
      }),
    });

    manager.requestSync();
    await flush();

    status = getSyncOutboxStatus();
    expect(status.pending).toBe(0);
    manager.stop();
  });
});
