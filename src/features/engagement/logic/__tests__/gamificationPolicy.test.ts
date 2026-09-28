import {
  BADGE_DEFINITIONS,
  ON_TIME_WATER_POINTS,
  XP_PER_RATING,
  addLocalDays,
  computeBestStreak,
  computeCurrentStreak,
  completedReviewSessionDays,
  deriveGamificationSnapshot,
  derivePetState,
  isOnTimeReview,
  sessionXp,
  toLocalDayKey,
} from '../gamificationPolicy';
import type {GamificationEventRecord} from '@shared/db/types';

function localIsoForDayKey(key: string, hour = 12): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, hour, 0, 0, 0).toISOString();
}

function sessionEvent(
  dayKey: string,
  points: number,
  sourceEventId = 'session-1',
): GamificationEventRecord {
  return {
    id: `ev-${dayKey}-${sourceEventId}-s`,
    eventType: 'review_session_completed',
    sourceEventId,
    points,
    createdAt: localIsoForDayKey(dayKey),
    revision: 0,
    tombstone: false,
  };
}

function onTimeEvent(
  dayKey: string,
  sourceEventId = 'session-1:card-1',
): GamificationEventRecord {
  return {
    id: `ev-${dayKey}-${sourceEventId}-t`,
    eventType: 'review_on_time',
    sourceEventId,
    points: ON_TIME_WATER_POINTS,
    createdAt: localIsoForDayKey(dayKey, 20),
    revision: 0,
    tombstone: false,
  };
}

describe('gamificationPolicy', () => {
  describe('XP scale', () => {
    it('scores each rating and sums a session from its counts', () => {
      expect(XP_PER_RATING.forgot).toBe(2);
      expect(XP_PER_RATING.remembered).toBe(7);

      expect(sessionXp({remembered: 1, forgot: 1})).toBe(7 + 2);
      expect(sessionXp({remembered: 3})).toBe(21);
      expect(sessionXp({})).toBe(0);
    });
  });

  describe('isOnTimeReview', () => {
    it('is on time when reviewed before the due UTC day ends', () => {
      expect(
        isOnTimeReview({
          dueAt: '2026-09-05T02:00:00.000Z',
          reviewedAt: '2026-09-05T20:00:00.000Z',
        }),
      ).toBe(true);
      expect(
        isOnTimeReview({
          dueAt: '2026-09-05T02:00:00.000Z',
          reviewedAt: '2026-09-05T23:59:59.999Z',
        }),
      ).toBe(true);
    });

    it('is late when reviewed after the due UTC day', () => {
      expect(
        isOnTimeReview({
          dueAt: '2026-09-04T02:00:00.000Z',
          reviewedAt: '2026-09-05T00:00:01.000Z',
        }),
      ).toBe(false);
    });

    it('never counts a card with unknown due time', () => {
      expect(
        isOnTimeReview({dueAt: null, reviewedAt: '2026-09-05T12:00:00.000Z'}),
      ).toBe(false);
    });
  });

  describe('local day helpers', () => {
    it('formats and shifts local calendar-day keys', () => {
      expect(toLocalDayKey(new Date(2026, 8, 5, 23, 30))).toBe('2026-09-05');
      expect(addLocalDays('2026-09-05', 1)).toBe('2026-09-06');
      expect(addLocalDays('2026-09-05', -1)).toBe('2026-09-04');
      expect(addLocalDays('2026-03-01', -1)).toBe('2026-02-28');
    });

    it('collects only the local days that have a completed session', () => {
      const events = [
        sessionEvent('2026-09-05', 7),
        sessionEvent('2026-09-05', 5),
        sessionEvent('2026-09-04', 7),
        onTimeEvent('2026-09-05'),
        onTimeEvent('2026-09-03'),
      ];
      expect(completedReviewSessionDays(events)).toEqual([
        '2026-09-04',
        '2026-09-05',
      ]);
    });
  });

  describe('computeCurrentStreak', () => {
    const today = new Date(2026, 8, 5, 9, 0, 0);

    it('is 0 with no completed days', () => {
      expect(computeCurrentStreak([], today)).toBe(0);
    });

    it('counts consecutive days ending today', () => {
      expect(
        computeCurrentStreak(['2026-09-03', '2026-09-04', '2026-09-05'], today),
      ).toBe(3);
    });

    it('stays alive when the most recent day is yesterday', () => {
      expect(computeCurrentStreak(['2026-09-03', '2026-09-04'], today)).toBe(2);
    });

    it('resets when the last completed day is older than yesterday', () => {
      expect(computeCurrentStreak(['2026-09-01', '2026-09-02'], today)).toBe(0);
    });

    it('ignores gaps when counting the trailing run', () => {
      expect(
        computeCurrentStreak(
          ['2026-09-01', '2026-09-03', '2026-09-04', '2026-09-05'],
          today,
        ),
      ).toBe(3);
    });
  });

  describe('computeBestStreak', () => {
    it('is 0 with no days', () => {
      expect(computeBestStreak([])).toBe(0);
    });

    it('finds the longest historical run even when broken now', () => {
      const keys = [
        '2026-08-01',
        '2026-08-02',
        '2026-08-03',
        '2026-08-05',
        '2026-09-04',
        '2026-09-05',
      ];
      expect(computeBestStreak(keys)).toBe(3);
    });

    it('counts a single day as a run of one', () => {
      expect(computeBestStreak(['2026-09-05'])).toBe(1);
    });
  });

  describe('derivePetState', () => {
    it('starts at the seed and reports water needed for the next stage', () => {
      const state = derivePetState(0);
      expect(state.stageId).toBe('seed');
      expect(state.waterForNextStage).toBe(5);
      expect(state.progressToNextStage).toBe(0);
    });

    it('advances stages at their water milestones', () => {
      expect(derivePetState(4).stageId).toBe('seed');
      expect(derivePetState(5).stageId).toBe('sprout');
      expect(derivePetState(15).stageId).toBe('sapling');
      expect(derivePetState(30).stageId).toBe('tree');
      expect(derivePetState(60).stageId).toBe('bloom');
    });

    it('clamps progress and is complete at the final stage', () => {
      const mid = derivePetState(10);
      expect(mid.stageId).toBe('sprout');
      expect(mid.waterForNextStage).toBe(5);
      expect(mid.progressToNextStage).toBe(0.5);

      const bloom = derivePetState(200);
      expect(bloom.waterForNextStage).toBeNull();
      expect(bloom.progressToNextStage).toBe(1);
    });
  });

  describe('deriveGamificationSnapshot', () => {
    const today = new Date(2026, 8, 5, 9, 0, 0);

    it('returns an empty baseline with no events', () => {
      const snapshot = deriveGamificationSnapshot([], today);
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

    it('sums XP/water and reproduces streak state from events only', () => {
      const events = [
        sessionEvent('2026-09-04', 7),
        sessionEvent('2026-09-05', sessionXp({remembered: 1, forgot: 1})),
        onTimeEvent('2026-09-05'),
        onTimeEvent('2026-09-05'),
        sessionEvent('2026-09-03', 2),
      ];
      const snapshot = deriveGamificationSnapshot(events, today);
      expect(snapshot.totalSessions).toBe(3);
      expect(snapshot.totalXp).toBe(7 + 9 + 2);
      expect(snapshot.waterUnits).toBe(2);
      expect(snapshot.currentStreak).toBe(3); // 03, 04, 05
      expect(snapshot.bestStreak).toBe(3);
      expect(snapshot.pet.stageId).toBe('seed');
    });

    it('awards the first-review badge after one completed session', () => {
      const snapshot = deriveGamificationSnapshot(
        [sessionEvent('2026-09-05', 7)],
        today,
      );
      expect(snapshot.badges.map(badge => badge.id)).toContain('first_review');
      expect(snapshot.badges.map(badge => badge.id)).not.toContain('xp_100');
    });

    it('awards thresholds badges from derived counters', () => {
      const events: GamificationEventRecord[] = [];
      for (let index = 0; index < 7; index += 1) {
        const dayKey = addLocalDays('2026-08-24', index);
        events.push(sessionEvent(dayKey, 7, `s-${index}`));
        events.push(onTimeEvent(dayKey, `s-${index}:c`));
      }
      const snapshot = deriveGamificationSnapshot(events, today);
      const ids = snapshot.badges.map(badge => badge.id);
      expect(ids).toContain('streak_7');
      expect(ids).toContain('first_review');
      expect(ids).not.toContain('water_10');
      expect(ids).not.toContain('xp_100');
      // 8 badges defined, all data-driven
      expect(BADGE_DEFINITIONS.length).toBe(8);
    });
  });
});
