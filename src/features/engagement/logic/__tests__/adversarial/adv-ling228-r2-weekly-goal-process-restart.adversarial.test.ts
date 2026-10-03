import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type {QuickSQLiteConnection} from 'react-native-quick-sqlite';

import type {RealSqliteConnection} from '@test/support/adversarial/realSqlite';

type Runtime = {
  connection: RealSqliteConnection;
  diligentKey: string;
  getDatabase: () => QuickSQLiteConnection;
  getGamificationSnapshot: (now?: Date) => {
    badges: Array<{id: string}>;
  };
};

let directory: string;
let databasePath: string;
let activeConnection: RealSqliteConnection | null;
let activeReset: ((connection?: QuickSQLiteConnection | null) => void) | null;

function startFreshRuntime(): Runtime {
  jest.resetModules();
  const database =
    require('@core/db/database') as typeof import('@core/db/database');
  const migrations =
    require('@core/db/migrations') as typeof import('@core/db/migrations');
  const badgeRepository =
    require('@features/engagement/logic/data/WeeklyGoalBadgeRepository') as typeof import('@features/engagement/logic/data/WeeklyGoalBadgeRepository');
  const gamification =
    require('@features/engagement/logic/gamification') as typeof import('@features/engagement/logic/gamification');
  const sqlite =
    require('@test/support/adversarial/realSqlite') as typeof import('@test/support/adversarial/realSqlite');

  const connection = sqlite.openRealSqlite(databasePath);
  database.resetDatabaseForTests(connection);
  migrations.runMigrations(connection);
  database.getDatabase();
  activeConnection = connection;
  activeReset = database.resetDatabaseForTests;

  return {
    connection,
    diligentKey: badgeRepository.DILIGENT_BADGE_LATCH_KEY,
    getDatabase: database.getDatabase,
    getGamificationSnapshot: gamification.getGamificationSnapshot,
  };
}

function stopRuntime(): void {
  activeReset?.(null);
  activeConnection?.close();
  activeConnection = null;
  activeReset = null;
}

function seedEarnedWeek(runtime: Runtime): void {
  for (let index = 0; index < 6; index += 1) {
    const completedAt = `2026-10-${String(6 + index).padStart(
      2,
      '0',
    )}T10:00:00.000Z`;
    runtime.getDatabase().execute(
      `INSERT INTO lesson_progress (
        lesson_id, status, started_at, completed_at, revision, tombstone, updated_at
      ) VALUES (?, 'completed', ?, ?, 0, 0, ?);`,
      [`lesson-${index}`, completedAt, completedAt, completedAt],
    );
  }
}

function readLatch(runtime: Runtime): string | null {
  const row = runtime
    .getDatabase()
    .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [
      runtime.diligentKey,
    ])
    .rows?.item(0) as {value?: string} | undefined;
  return row?.value ?? null;
}

function failDiligentLatchWrites(runtime: Runtime): void {
  runtime.connection.raw.exec(`CREATE TRIGGER fail_diligent_latch
    BEFORE INSERT ON app_settings
    WHEN NEW.key = '${runtime.diligentKey}'
    BEGIN
      SELECT RAISE(ABORT, 'injected diligent latch failure');
    END;`);
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ling228-adv-r2-'));
  databasePath = path.join(directory, 'lingobites.sqlite');
  activeConnection = null;
  activeReset = null;
});

afterEach(() => {
  stopRuntime();
  jest.resetModules();
  fs.rmSync(directory, {recursive: true, force: true});
});

describe('LING-228 INV-002 write-failure re-sweep', () => {
  it('HELD / INV-002: restart and week rollover re-derive while earned rows remain', () => {
    const firstRuntime = startFreshRuntime();
    seedEarnedWeek(firstRuntime);
    failDiligentLatchWrites(firstRuntime);

    const firstRead = firstRuntime.getGamificationSnapshot(
      new Date('2026-10-08T12:00:00.000Z'),
    );
    expect(firstRead.badges.map(badge => badge.id)).toContain('diligent');
    expect(readLatch(firstRuntime)).toBeNull();

    firstRuntime.connection.raw.exec('DROP TRIGGER fail_diligent_latch;');
    stopRuntime();

    const afterProcessRestart = startFreshRuntime();
    const afterWeekRollover = afterProcessRestart.getGamificationSnapshot(
      new Date('2026-10-22T12:00:00.000Z'),
    );
    expect(afterWeekRollover.badges.map(badge => badge.id)).toContain(
      'diligent',
    );
    expect(readLatch(afterProcessRestart)).not.toBeNull();
  });
});

describe.each([1, 2, 3])('LING-228 adversarial review r2 run %i', () => {
  it('ADV-002 / INV-002: a failed latch write survives a real process restart and row loss', () => {
    const firstRuntime = startFreshRuntime();
    seedEarnedWeek(firstRuntime);
    failDiligentLatchWrites(firstRuntime);

    const firstRead = firstRuntime.getGamificationSnapshot(
      new Date('2026-10-08T12:00:00.000Z'),
    );
    expect(firstRead.badges.map(badge => badge.id)).toContain('diligent');
    expect(readLatch(firstRuntime)).toBeNull();

    firstRuntime.connection.raw.exec('DROP TRIGGER fail_diligent_latch;');
    stopRuntime();

    const afterProcessRestart = startFreshRuntime();
    afterProcessRestart.getDatabase().execute('DELETE FROM lesson_progress;');
    const afterRowLoss = afterProcessRestart.getGamificationSnapshot(
      new Date('2026-10-08T12:00:00.000Z'),
    );
    expect(afterRowLoss.badges.map(badge => badge.id)).toContain('diligent');
  });
});
