import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {DILIGENT_BADGE_LATCH_KEY} from '@features/engagement/logic/data/WeeklyGoalBadgeRepository';
import {getGamificationSnapshot} from '@features/engagement/logic/gamification';
import {getWeeklyGoalState} from '@features/engagement/logic/weeklyGoal';

import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

let directory: string;
let databasePath: string;
let connection: RealSqliteConnection | null;

function openDatabase(): void {
  connection = openRealSqlite(databasePath);
  resetDatabaseForTests(connection);
  runMigrations(connection);
  getDatabase();
}

function seedEarnedWeek(): void {
  for (let index = 0; index < 6; index += 1) {
    const completedAt = `2026-10-${String(6 + index).padStart(
      2,
      '0',
    )}T10:00:00.000Z`;
    insertCompleted(`lesson-${index}`, completedAt);
  }
}

function insertCompleted(lessonId: string, completedAt: string): void {
  getDatabase().execute(
    `INSERT INTO lesson_progress (
      lesson_id, status, started_at, completed_at, revision, tombstone, updated_at
    ) VALUES (?, 'completed', ?, ?, 0, 0, ?);`,
    [lessonId, completedAt, completedAt, completedAt],
  );
}

function failDiligentLatchWrites(): void {
  connection?.raw.exec(`CREATE TRIGGER fail_diligent_latch
    BEFORE INSERT ON app_settings
    WHEN NEW.key = '${DILIGENT_BADGE_LATCH_KEY}'
    BEGIN
      SELECT RAISE(ABORT, 'injected diligent latch failure');
    END;`);
}

function restartAndAllowLatchWrites(): void {
  resetDatabaseForTests(null);
  connection?.close();
  openDatabase();
  connection?.raw.exec('DROP TRIGGER fail_diligent_latch;');
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
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ling228-adv-r1-'));
  databasePath = path.join(directory, 'lingobites.sqlite');
  connection = null;
  openDatabase();
});

afterEach(() => {
  resetDatabaseForTests(null);
  connection?.close();
  fs.rmSync(directory, {recursive: true, force: true});
});

describe('LING-228 adversarial review r1', () => {
  it('HELD / INV-001: fixed instants rebucket exactly once across process timezones', () => {
    const firstCompletion = '2026-10-05T03:00:00.000Z';
    insertCompleted('timezone-first', firstCompletion);
    insertCompleted('timezone-second', '2026-10-06T03:00:00.000Z');

    // In UTC+7 the first instant is Monday (both rows count); in UTC-5 it is
    // Sunday (only the second row belongs to the current Monday-start week).
    const expectedCount = new Date(firstCompletion).getDay() === 0 ? 1 : 2;
    expect(
      getWeeklyGoalState(new Date('2026-10-07T05:00:00.000Z'))
        .completedThisWeek,
    ).toBe(expectedCount);
  });

  it('ADV-001 / INV-002: an observed badge survives a failed latch write, restart, and row loss', () => {
    seedEarnedWeek();
    failDiligentLatchWrites();

    const firstRead = getGamificationSnapshot(
      new Date('2026-10-08T12:00:00.000Z'),
    );
    expect(firstRead.badges.map(badge => badge.id)).toContain('diligent');
    expect(readLatch()).toBeNull();

    restartAndAllowLatchWrites();
    getDatabase().execute('DELETE FROM lesson_progress;');

    const afterRestartAndRowLoss = getGamificationSnapshot(
      new Date('2026-10-08T12:00:00.000Z'),
    );
    expect(afterRestartAndRowLoss.badges.map(badge => badge.id)).toContain(
      'diligent',
    );
  });
});
