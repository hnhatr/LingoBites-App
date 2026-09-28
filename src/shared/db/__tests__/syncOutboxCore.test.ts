import {__resetMockDatabases} from '../../../../test-utils/sqliteMock';
import {open} from 'react-native-quick-sqlite';
import {getDatabase, resetDatabaseForTests} from '../database';
import {DB_NAME} from '../constants';
import {enqueueSyncOutboxEvent} from '../syncOutboxCore';
import {listPendingSyncEvents} from '@features/sync/logic/adapters/SyncOutboxRepository';
import type {ReviewEventPayload} from '../types';

const payload: ReviewEventPayload = {
  schema_version: 1,
  card_id: 'card-1',
  lesson_id: 'lesson-1',
  rating: 'remembered',
  reviewed_at: '2026-09-05T12:00:00.000Z',
  interval_days: 7,
  next_review_at: '2026-09-12T12:00:00.000Z',
};

describe('syncOutboxCore', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    getDatabase();
  });

  it('enqueues an event as pending with default attempts and no error', () => {
    enqueueSyncOutboxEvent({
      id: 'event-1',
      entityId: 'card-1',
      payload,
      createdAt: '2026-09-05T12:00:00.000Z',
    });

    const pending = listPendingSyncEvents();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      id: 'event-1',
      eventType: 'review',
      entityId: 'card-1',
      attemptCount: 0,
      lastError: null,
      syncedAt: null,
      createdAt: '2026-09-05T12:00:00.000Z',
    });
    expect(pending[0].payload).toEqual(payload);
  });
});
