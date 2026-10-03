import {
  anyWeekReachesTarget,
  countCompletionsInWeek,
  startOfLocalWeek,
  WEEKLY_LESSON_TARGET,
  type WeeklyGoalLessonRow,
} from '../weeklyGoalPolicy';

function localDate(
  year: number,
  month: number,
  day: number,
  hour = 12,
  minute = 0,
  second = 0,
  ms = 0,
): Date {
  return new Date(year, month - 1, day, hour, minute, second, ms);
}

function localIso(
  year: number,
  month: number,
  day: number,
  hour = 12,
  minute = 0,
  second = 0,
  ms = 0,
): string {
  return localDate(year, month, day, hour, minute, second, ms).toISOString();
}

describe('weeklyGoalPolicy (TC-2A / INV-001)', () => {
  it('uses a fixed target of six lessons per week', () => {
    expect(WEEKLY_LESSON_TARGET).toBe(6);
  });

  it('starts the local week on Monday 00:00', () => {
    const monday = localDate(2026, 10, 5, 15, 30);
    const start = startOfLocalWeek(monday);
    expect(start).toEqual(localDate(2026, 10, 5, 0, 0, 0, 0));
    const sunday = localDate(2026, 10, 11, 23, 59, 59, 999);
    expect(startOfLocalWeek(sunday)).toEqual(
      localDate(2026, 10, 5, 0, 0, 0, 0),
    );
  });

  describe('AC-002 S1 week boundary', () => {
    const rows: WeeklyGoalLessonRow[] = [
      {
        lessonId: 'lesson-sun',
        completedAt: localIso(2026, 10, 11, 23, 59, 59, 999),
      },
      {
        lessonId: 'lesson-mon',
        completedAt: localIso(2026, 10, 12, 0, 0, 0, 0),
      },
    ];

    it('counts Sunday 23:59:59.999 in the previous week when now is Monday', () => {
      const now = localDate(2026, 10, 12, 9, 0);
      expect(countCompletionsInWeek(rows, now)).toBe(1);
    });

    it('places Monday 00:00 in the new week', () => {
      const nowMonday = localDate(2026, 10, 12, 0, 0, 1);
      expect(countCompletionsInWeek(rows, nowMonday)).toBe(1);
      const nowSundayWeek = localDate(2026, 10, 11, 12, 0);
      expect(countCompletionsInWeek(rows, nowSundayWeek)).toBe(1);
    });
  });

  it('ignores unparseable completion times', () => {
    const rows: WeeklyGoalLessonRow[] = [
      {lessonId: 'a', completedAt: 'not-a-date'},
      {lessonId: 'b', completedAt: localIso(2026, 10, 5, 10)},
    ];
    expect(countCompletionsInWeek(rows, localDate(2026, 10, 6))).toBe(1);
  });

  it('counts each lesson row once in the current week (INV-001)', () => {
    const now = localDate(2026, 10, 8);
    const rows: WeeklyGoalLessonRow[] = [
      {lessonId: 'l1', completedAt: localIso(2026, 10, 6)},
      {lessonId: 'l2', completedAt: localIso(2026, 10, 7)},
      {lessonId: 'l3', completedAt: localIso(2026, 10, 5, 23, 59)},
    ];
    expect(countCompletionsInWeek(rows, now)).toBe(3);
  });

  describe('AC-002 S3 timezone rebucketing', () => {
    const originalTz = process.env.TZ;

    afterEach(() => {
      process.env.TZ = originalTz;
    });

    it('recomputes N when TZ changes (Asia/Ho_Chi_Minh → America/Bogota)', () => {
      process.env.TZ = 'Asia/Ho_Chi_Minh';
      const rows: WeeklyGoalLessonRow[] = [
        {
          lessonId: 'hcm-1',
          completedAt: new Date('2026-10-05T10:00:00').toISOString(),
        },
        {
          lessonId: 'hcm-2',
          completedAt: new Date('2026-10-06T10:00:00').toISOString(),
        },
      ];
      const nowHcm = new Date('2026-10-07T12:00:00');
      expect(countCompletionsInWeek(rows, nowHcm)).toBe(2);

      process.env.TZ = 'America/Bogota';
      const nowBogota = new Date('2026-10-07T12:00:00');
      expect(countCompletionsInWeek(rows, nowBogota)).toBe(2);
    });
  });

  describe('DST week (Europe/Berlin)', () => {
    const originalTz = process.env.TZ;

    afterEach(() => {
      process.env.TZ = originalTz;
    });

    it('uses half-open local weeks across DST spring forward', () => {
      process.env.TZ = 'Europe/Berlin';
      const weekStart = startOfLocalWeek(new Date('2026-03-23T12:00:00'));
      expect(weekStart.getDay()).toBe(1);
      const rows: WeeklyGoalLessonRow[] = [
        {
          lessonId: 'pre-dst',
          completedAt: new Date(2026, 2, 27, 10, 0, 0, 0).toISOString(),
        },
        {
          lessonId: 'post-dst',
          completedAt: new Date(2026, 2, 29, 10, 0, 0, 0).toISOString(),
        },
      ];
      const now = new Date(2026, 2, 29, 18, 0, 0, 0);
      expect(countCompletionsInWeek(rows, now)).toBe(2);
    });
  });

  describe('anyWeekReachesTarget', () => {
    it('is false until a week has six completions', () => {
      const rows: WeeklyGoalLessonRow[] = Array.from({length: 5}, (_, i) => ({
        lessonId: `l-${i}`,
        completedAt: localIso(2026, 10, 5 + i, 10),
      }));
      expect(anyWeekReachesTarget(rows)).toBe(false);
      rows.push({
        lessonId: 'l-5',
        completedAt: localIso(2026, 10, 10, 10),
      });
      expect(anyWeekReachesTarget(rows)).toBe(true);
    });
  });
});
