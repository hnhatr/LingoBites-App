import {__resetMockDatabases} from '../../../../../../test-utils/sqliteMock';
import {resetDatabaseForTests} from '@core/db/database';
import {open} from 'react-native-quick-sqlite';
import {DB_NAME} from '@core/db/constants';
import {
  insertGamificationEvent,
  listGamificationEvents,
} from '../GamificationRepository';
import type {GamificationEventRecord} from '@core/db/types';

describe('GamificationRepository', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
  });

  it('appends an event and returns the stored record', () => {
    const record = insertGamificationEvent({
      eventType: 'review_session_completed',
      sourceEventId: 'session-1',
      points: 12,
      createdAt: '2026-09-05T12:00:00.000Z',
    });

    expect(record.eventType).toBe('review_session_completed');
    expect(record.sourceEventId).toBe('session-1');
    expect(record.points).toBe(12);
    expect(record.createdAt).toBe('2026-09-05T12:00:00.000Z');

    const all = listGamificationEvents();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(record);
  });

  it('lists events oldest first across multiple appends', () => {
    insertGamificationEvent({
      eventType: 'review_session_completed',
      sourceEventId: 'session-1',
      points: 7,
      createdAt: '2026-09-04T12:00:00.000Z',
    });
    insertGamificationEvent({
      eventType: 'review_on_time',
      sourceEventId: 'session-1:card-1',
      points: 1,
      createdAt: '2026-09-05T08:00:00.000Z',
    });

    const all = listGamificationEvents();
    expect(all.map(event => event.eventType)).toEqual([
      'review_session_completed',
      'review_on_time',
    ]);
    expect(all.map(event => event.id)).toEqual(
      expect.arrayContaining([expect.any(String), expect.any(String)]),
    );
  });

  it('keeps event rows durable enough to re-derive state from (VC-6)', () => {
    insertGamificationEvent({
      eventType: 'review_session_completed',
      sourceEventId: 'session-1',
      points: 5,
      createdAt: '2026-09-05T12:00:00.000Z',
    });
    // A fresh read of the log reproduces the same committed events.
    const events: GamificationEventRecord[] = listGamificationEvents();
    expect(events).toHaveLength(1);
    expect(events[0].points).toBe(5);
    expect(events[0].sourceEventId).toBe('session-1');
  });
});
