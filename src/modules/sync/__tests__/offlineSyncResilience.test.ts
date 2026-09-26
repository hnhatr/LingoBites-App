import {__resetMockDatabases} from '../../../../test-utils/sqliteMock';
import {open} from 'react-native-quick-sqlite';
import {getDatabase, resetDatabaseForTests} from '@shared/db/database';
import {DB_NAME} from '@shared/db/constants';
import {
  enqueueSyncOutboxEvent,
  listPendingSyncEvents,
} from '@shared/db/SyncOutboxRepository';
import {drainOutboxOnce} from '../outboxSync';
import {getCapabilityProgressReport} from '@shared/db/PilotMetricsRepository';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  __resetMockDatabases();
  resetDatabaseForTests(open({name: DB_NAME}));
  getDatabase();
  mockFetch.mockReset();
});

describe('Offline / Sync Resilience (REQ-45 / VC-23)', () => {
  test('offline review and progress updates succeed locally and queue sync safely without blocking', async () => {
    // 1. Network is down / fetch throws Network Error
    mockFetch.mockRejectedValue(new Error('Network offline'));

    // 2. Queue review sync event while offline
    enqueueSyncOutboxEvent({
      id: 'offline-rev-1',
      entityId: 'card-101',
      payload: {
        schema_version: 1,
        card_id: 'card-101',
        lesson_id: 'lesson-101',
        rating: 'remembered',
        reviewed_at: '2026-09-07T10:00:00.000Z',
        interval_days: 3,
        next_review_at: '2026-09-10T10:00:00.000Z',
      },
    });

    // 3. Local progress report and state are immediately updated and available offline
    const reportBeforeSync = getCapabilityProgressReport(
      '2026-09-07T10:05:00.000Z',
    );
    expect(reportBeforeSync).toBeDefined();

    // 4. Attempting to drain outbox while network is offline fails gracefully with retryable outcome
    const drainOutcome = await drainOutboxOnce();
    expect(drainOutcome.status).toBe('failed');
    if (drainOutcome.status === 'failed') {
      expect(drainOutcome.retryable).toBe(true);
    }

    // Pending event remains safely queued in local SQLite outbox
    const pendingEvents = listPendingSyncEvents();
    expect(pendingEvents).toHaveLength(1);
    expect(pendingEvents[0].id).toBe('offline-rev-1');
    expect(pendingEvents[0].attemptCount).toBe(1);

    // 5. Network comes back online: server accepts the event
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        request_id: 'req-srv-1',
        status: 'success',
        accepted: 1,
        duplicates: 0,
        accepted_ids: ['offline-rev-1'],
        duplicate_ids: [],
      }),
    });

    const retryOutcome = await drainOutboxOnce();
    expect(retryOutcome).toEqual({
      status: 'synced',
      syncedIds: ['offline-rev-1'],
    });

    // Outbox is now empty
    expect(listPendingSyncEvents()).toHaveLength(0);
  });
});
