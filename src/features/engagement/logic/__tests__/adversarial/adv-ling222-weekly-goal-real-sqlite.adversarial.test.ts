import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  DILIGENT_BADGE_LATCH_KEY,
  latchDiligentBadgeEarnedAt,
  readDiligentBadgeLatch,
} from '@features/engagement/logic/data/WeeklyGoalBadgeRepository';
import {getGamificationSnapshot} from '@features/engagement/logic/gamification';
import {getWeeklyGoalState} from '@features/engagement/logic/weeklyGoal';

import {
  executeAccountReplacementTransaction,
  getDatabase,
  resetDatabaseForTests,
} from '@core/db/database';
import {clearAllLocalDatabaseRows} from '@core/db/localDataWipe';
import {runMigrations} from '@core/db/migrations';
import {recordLessonEvent} from '@core/sync/lessonProgress';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

/**
 * LING-222 TASK-002 (TC-2B): weekly goal latch + INV-001/INV-002/INV-T1 on real SQLite.
 */

const USER_B = '22222222-2222-4222-8222-222222222222';
const T_WEEK = '2026-10-06T10:00:00.000Z';
const T_LATER_WEEK = '2026-10-20T10:00:00.000Z';

let dir: string;
let dbFile: string;

function coldStart(): RealSqliteConnection {
  const connection = openRealSqlite(dbFile);
  resetDatabaseForTests(connection);
  runMigrations(connection);
  getDatabase();
  return connection;
}

function insertCompleted(
  lessonId: string,
  completedAt: string,
  startedAt = completedAt,
): void {
  getDatabase().execute(
    `INSERT INTO lesson_progress (
      lesson_id, status, started_at, completed_at, revision, tombstone, updated_at
    ) VALUES (?, 'completed', ?, ?, 0, 0, ?);`,
    [lessonId, startedAt, completedAt, completedAt],
  );
}

function seedSixInWeek(baseIso: string): void {
  for (let i = 0; i < 6; i += 1) {
    const day = new Date(baseIso);
    day.setDate(day.getDate() + i);
    insertCompleted(`lesson-${baseIso}-${i}`, day.toISOString());
  }
}

function readLatch(): string | null {
  const row = getDatabase()
    .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [
      DILIGENT_BADGE_LATCH_KEY,
    ])
    .rows?.item(0) as {value?: string} | undefined;
  return row?.value ?? null;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ling222-weekly-'));
  dbFile = path.join(dir, 'lingobites.sqlite');
});

afterEach(() => {
  resetDatabaseForTests(null);
  fs.rmSync(dir, {recursive: true, force: true});
});

describe('ADV / LING-222 weekly goal (TC-2B)', () => {
  it('INV-001: duplicate complete keeps one row and counts once', () => {
    coldStart();
    const at = T_WEEK;
    const first = recordLessonEvent({
      lessonId: 'lesson-dup',
      event: 'complete',
      occurredAt: at,
    });
    const second = recordLessonEvent({
      lessonId: 'lesson-dup',
      event: 'complete',
      occurredAt: '2026-10-07T10:00:00.000Z',
    });
    expect(first.ok).toBe(true);
    expect(second).toMatchObject({ok: true, advanced: false});

    const now = new Date('2026-10-08T12:00:00.000Z');
    expect(getWeeklyGoalState(now).completedThisWeek).toBe(1);
  });

  it('INV-002: latch survives zone change and row deletion after earn', () => {
    const originalTz = process.env.TZ;
    process.env.TZ = 'Asia/Ho_Chi_Minh';
    coldStart();
    seedSixInWeek(T_WEEK);
    const now = new Date('2026-10-08T12:00:00.000Z');
    const snapshot = getGamificationSnapshot(now);
    expect(snapshot.badges.map(b => b.id)).toContain('diligent');
    expect(readLatch()).not.toBeNull();
    const badgeCount = snapshot.badges.length;

    process.env.TZ = 'America/Bogota';
    getDatabase().execute(
      "DELETE FROM lesson_progress WHERE lesson_id LIKE 'lesson-2026-10-06%';",
    );
    const after = getGamificationSnapshot(new Date('2026-10-08T12:00:00.000Z'));
    expect(after.badges.map(b => b.id)).toContain('diligent');
    expect(after.badges.length).toBe(badgeCount);

    process.env.TZ = originalTz;
  });

  it('INV-002: six more completions in a later week do not add duplicate diligent badge (AC-006 S3)', () => {
    coldStart();
    seedSixInWeek(T_WEEK);
    const weekOne = getGamificationSnapshot(
      new Date('2026-10-08T12:00:00.000Z'),
    );
    expect(weekOne.badges.filter(b => b.id === 'diligent')).toHaveLength(1);

    seedSixInWeek(T_LATER_WEEK);
    const weekTwo = getGamificationSnapshot(
      new Date('2026-10-22T12:00:00.000Z'),
    );
    expect(weekTwo.badges.filter(b => b.id === 'diligent')).toHaveLength(1);
    expect(weekTwo.weeklyGoal.completedThisWeek).toBe(6);
  });

  it('INSERT OR IGNORE keeps the first latch value', () => {
    coldStart();
    latchDiligentBadgeEarnedAt('2026-10-01T00:00:00.000Z');
    latchDiligentBadgeEarnedAt('2026-10-02T00:00:00.000Z');
    expect(readDiligentBadgeLatch()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('INV-T1: account replacement clears the latch', () => {
    coldStart();
    latchDiligentBadgeEarnedAt('2026-10-01T00:00:00.000Z');
    executeAccountReplacementTransaction(getDatabase(), USER_B);
    expect(readLatch()).toBeNull();
  });

  it('INV-T1: local data wipe clears the latch', async () => {
    coldStart();
    latchDiligentBadgeEarnedAt('2026-10-01T00:00:00.000Z');
    await clearAllLocalDatabaseRows();
    expect(readLatch()).toBeNull();
  });

  it('AC-007 S3: after reset, badge re-derives from pulled completions in a past week', async () => {
    coldStart();
    seedSixInWeek('2026-09-01T10:00:00.000Z');
    getGamificationSnapshot(new Date('2026-09-10T12:00:00.000Z'));
    expect(readLatch()).not.toBeNull();

    await clearAllLocalDatabaseRows();
    expect(readLatch()).toBeNull();

    seedSixInWeek('2026-09-01T10:00:00.000Z');
    const again = getGamificationSnapshot(new Date('2026-09-10T12:00:00.000Z'));
    expect(again.badges.map(b => b.id)).toContain('diligent');
    expect(readLatch()).not.toBeNull();
  });
});
