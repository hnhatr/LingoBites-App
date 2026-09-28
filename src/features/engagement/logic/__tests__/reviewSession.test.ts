import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {resetDatabaseForTests} from '@core/db/database';
import {open} from 'react-native-quick-sqlite';
import {DB_NAME} from '@core/db/constants';
import {listGamificationEvents} from '../data/GamificationRepository';
import {startReviewSession} from '../reviewSession';

describe('reviewSession (engagement)', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
  });

  it('records nothing and persists nothing when the session has no ratings', () => {
    const session = startReviewSession();
    expect(session.finish()).toBeNull();
    expect(session.ratedCount).toBe(0);
    expect(listGamificationEvents()).toHaveLength(0);
  });

  it('persists one session event + one on-time event per timely card (ADR-4)', () => {
    const session = startReviewSession();
    session.record({
      flashcardId: 'card-1',
      rating: 'remembered',
      dueAt: '2026-09-05T02:00:00.000Z',
      reviewedAt: '2026-09-05T20:00:00.000Z',
    });
    session.record({
      flashcardId: 'card-2',
      rating: 'forgot',
      dueAt: '2026-09-04T02:00:00.000Z',
      reviewedAt: '2026-09-05T20:00:00.000Z',
    });
    expect(session.ratedCount).toBe(2);

    const result = session.finish('2026-09-05T21:00:00.000Z');
    expect(result).toEqual({
      ok: true,
      xpEarned: 9, // remembered(7) + forgot(2)
      onTimeCount: 1, // only card-1 reviewed on its due day
      waterUnits: 1,
    });

    const events = listGamificationEvents();
    expect(events).toHaveLength(2);
    const sessionEvent = events.find(
      event => event.eventType === 'review_session_completed',
    );
    const onTimeEvent = events.find(
      event => event.eventType === 'review_on_time',
    );
    expect(sessionEvent?.points).toBe(9);
    expect(sessionEvent?.sourceEventId).toBe(session.sessionId);
    expect(sessionEvent?.createdAt).toBe('2026-09-05T21:00:00.000Z');
    expect(onTimeEvent?.points).toBe(1);
    expect(onTimeEvent?.sourceEventId).toBe(`${session.sessionId}:card-1`);
  });

  it('is idempotent — finishing twice never duplicates events', () => {
    const session = startReviewSession();
    session.record({
      flashcardId: 'card-1',
      rating: 'remembered',
      dueAt: '2026-09-05T02:00:00.000Z',
      reviewedAt: '2026-09-05T20:00:00.000Z',
    });
    session.finish('2026-09-05T21:00:00.000Z');
    expect(session.finish('2026-09-05T22:00:00.000Z')).toBeNull();

    const events = listGamificationEvents();
    expect(events).toHaveLength(2); // one session + one on-time
  });

  it('ignores records made after the session finished', () => {
    const session = startReviewSession();
    session.record({
      flashcardId: 'card-1',
      rating: 'remembered',
      dueAt: '2026-09-05T02:00:00.000Z',
      reviewedAt: '2026-09-05T20:00:00.000Z',
    });
    const first = session.finish();
    expect(first?.ok).toBe(true);
    session.record({
      flashcardId: 'card-2',
      rating: 'remembered',
      dueAt: '2026-09-05T02:00:00.000Z',
      reviewedAt: '2026-09-05T21:00:00.000Z',
    });
    expect(session.ratedCount).toBe(1);
    expect(session.finish()).toBeNull();
    expect(listGamificationEvents()).toHaveLength(2);
  });
});
