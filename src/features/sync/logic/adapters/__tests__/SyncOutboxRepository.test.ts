import {__resetMockDatabases} from '../../../../../../test-utils/sqliteMock';
import {open} from 'react-native-quick-sqlite';
import {getDatabase, resetDatabaseForTests} from '@shared/db/database';
import {DB_NAME} from '@shared/db/constants';
import {enqueueSyncOutboxEvent} from '@shared/db/syncOutboxCore';
import type {ReviewEventPayload} from '@shared/db/types';
import {
  countPendingSyncEvents,
  deleteSyncEvents,
  listPendingSyncEvents,
  markSyncEventsFailed,
  markSyncEventsSynced,
} from '../SyncOutboxRepository';

const payload: ReviewEventPayload = {
  schema_version: 1,
  card_id: 'card-1',
  lesson_id: 'lesson-1',
  rating: 'remembered',
  reviewed_at: '2026-09-05T12:00:00.000Z',
  interval_days: 7,
  next_review_at: '2026-09-12T12:00:00.000Z',
};

describe('SyncOutboxRepository adapter', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    getDatabase();
  });

  it('lists pending events oldest-first and respects the limit', () => {
    for (const [id, createdAt] of [
      ['event-2', '2026-09-05T13:00:00.000Z'],
      ['event-1', '2026-09-05T12:00:00.000Z'],
      ['event-3', '2026-09-05T14:00:00.000Z'],
    ]) {
      enqueueSyncOutboxEvent({
        id,
        entityId: 'card-1',
        payload,
        createdAt,
      });
    }

    expect(listPendingSyncEvents().map(event => event.id)).toEqual([
      'event-1',
      'event-2',
      'event-3',
    ]);
    expect(listPendingSyncEvents({limit: 2}).map(event => event.id)).toEqual([
      'event-1',
      'event-2',
    ]);
  });

  it('marks only pending ids as synced', () => {
    enqueueSyncOutboxEvent({id: 'event-1', entityId: 'c', payload});
    enqueueSyncOutboxEvent({id: 'event-2', entityId: 'c', payload});
    enqueueSyncOutboxEvent({id: 'event-3', entityId: 'c', payload});
    markSyncEventsSynced(['event-1', 'event-3'], '2026-09-05T15:00:00.000Z');

    expect(listPendingSyncEvents().map(event => event.id)).toEqual(['event-2']);
    expect(countPendingSyncEvents()).toBe(1);
  });

  it('records a failed attempt by incrementing attempt_count and storing the error', () => {
    enqueueSyncOutboxEvent({id: 'event-1', entityId: 'c', payload});

    markSyncEventsFailed(['event-1'], 'network down');
    markSyncEventsFailed(['event-1'], 'network down again');

    const pending = listPendingSyncEvents();
    expect(pending).toHaveLength(1);
    expect(pending[0].attemptCount).toBe(2);
    expect(pending[0].lastError).toBe('network down again');
  });

  it('does not increment attempts for an already-synced row', () => {
    enqueueSyncOutboxEvent({id: 'event-1', entityId: 'c', payload});
    markSyncEventsSynced(['event-1'], '2026-09-05T15:00:00.000Z');

    expect(markSyncEventsFailed(['event-1'], 'late failure')).toBe(0);
    expect(listPendingSyncEvents()).toHaveLength(0);
  });

  it('deletes rows by id', () => {
    enqueueSyncOutboxEvent({id: 'event-1', entityId: 'c', payload});
    enqueueSyncOutboxEvent({id: 'event-2', entityId: 'c', payload});

    expect(deleteSyncEvents(['event-1'])).toBe(1);
    expect(countPendingSyncEvents()).toBe(1);
    expect(listPendingSyncEvents()[0].id).toBe('event-2');
  });
});
