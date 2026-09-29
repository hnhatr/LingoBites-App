import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {resetDatabaseForTests} from '@core/db/database';
import {open} from 'react-native-quick-sqlite';
import {DB_NAME} from '@core/db/constants';
import {addLocalDays, toLocalDayKey} from '../gamificationPolicy';
import {getGamificationSnapshot} from '../gamification';
import {startReviewSession} from '../reviewSession';

function isoOnDayKey(key: string, hour: number): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, hour, 0, 0, 0).toISOString();
}

// A single shared UTC day used for the per-card due/review instants, so the
// on-time comparison (which is UTC-day based) holds in any timezone.
const DUE_AT = '2026-09-05T02:00:00.000Z';
const REVIEWED_AT = '2026-09-05T20:00:00.000Z';

describe('gamification snapshot service (VC-6)', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
  });

  it('reproduces the same streak/XP/pet state purely from persisted events', () => {
    // Two completed sessions on two consecutive local days, each reviewing one
    // card on time. Local day keys are derived (not hard-coded) so the test is
    // timezone-independent.
    const lastDayKey = toLocalDayKey(new Date('2026-09-05T21:00:00.000Z'));
    const firstDayKey = addLocalDays(lastDayKey, -1);

    for (const dayKey of [firstDayKey, lastDayKey]) {
      const session = startReviewSession();
      session.record({
        flashcardId: `card-${dayKey}`,
        rating: 'remembered',
        dueAt: DUE_AT,
        reviewedAt: REVIEWED_AT,
      });
      const outcome = session.finish(isoOnDayKey(dayKey, 21));
      expect(outcome?.ok).toBe(true);
    }

    // A fresh recomputation from the event log (as on a later app launch).
    const snapshot = getGamificationSnapshot(
      new Date(`${lastDayKey}T12:00:00`),
    );
    expect(snapshot.totalSessions).toBe(2);
    expect(snapshot.totalXp).toBe(14); // 2 × remembered(7)
    expect(snapshot.waterUnits).toBe(2);
    expect(snapshot.currentStreak).toBe(2);
    expect(snapshot.bestStreak).toBe(2);
    expect(snapshot.pet.waterUnits).toBe(2);
    expect(snapshot.badges.map(badge => badge.id)).toContain('first_review');
  });

  it('returns an empty baseline when no events have ever been committed', () => {
    const snapshot = getGamificationSnapshot();
    expect(snapshot).toMatchObject({
      totalSessions: 0,
      totalXp: 0,
      currentStreak: 0,
      bestStreak: 0,
      waterUnits: 0,
      badges: [],
    });
    expect(snapshot.pet.stageId).toBe('seed');
  });
});
