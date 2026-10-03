import {spawnSync} from 'node:child_process';
import path from 'node:path';

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

  (process.env.AC002_S3_PROBE === '1' ? describe.skip : describe)(
    'AC-002 S3 timezone rebucketing',
    () => {
      const originalTz = process.env.TZ;

      afterEach(() => {
        process.env.TZ = originalTz;
      });

      it('rebucks N when TZ changes (Asia/Ho_Chi_Minh → America/Bogota)', () => {
        const appRoot = path.join(__dirname, '../../../../..');
        const countInFreshProcess = (tz: string): number => {
          const probePattern = 'AC-002 S3 timezone probe';
          const result = spawnSync(
            `yarn test src/features/engagement/logic/__tests__/weeklyGoalPolicy.test.ts --runInBand -t "${probePattern}"`,
            {
              cwd: appRoot,
              env: {...process.env, TZ: tz, AC002_S3_PROBE: '1'},
              encoding: 'utf8',
              shell: true,
            },
          );
          expect(result.status).toBe(0);
          const output = `${result.stdout}\n${result.stderr}`;
          const match = output.match(/AC002_S3_COUNT=(\d+)/);
          expect(match).not.toBeNull();
          return Number(match![1]);
        };

        expect(countInFreshProcess('Asia/Ho_Chi_Minh')).toBe(2);
        expect(countInFreshProcess('America/Bogota')).toBe(1);
      });
    },
  );

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

  (process.env.AC002_S3_PROBE === '1' ? describe : describe.skip)(
    'AC-002 S3 timezone probe',
    () => {
      it('prints the weekly count for fixed UTC instants', () => {
        const rows: WeeklyGoalLessonRow[] = [
          {
            lessonId: 'tz-first',
            completedAt: '2026-10-05T03:00:00.000Z',
          },
          {
            lessonId: 'tz-second',
            completedAt: '2026-10-06T03:00:00.000Z',
          },
        ];
        const count = countCompletionsInWeek(
          rows,
          new Date('2026-10-07T05:00:00.000Z'),
        );

        console.log(`AC002_S3_COUNT=${count}`);
      });
    },
  );

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
