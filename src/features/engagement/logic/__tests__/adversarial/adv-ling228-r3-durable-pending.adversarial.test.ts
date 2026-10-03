import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type {QuickSQLiteConnection} from 'react-native-quick-sqlite';

import type {RealSqliteConnection} from '@test/support/adversarial/realSqlite';

type Runtime = {
  connection: RealSqliteConnection;
  diligentKey: string;
  pendingKey: string;
  getDatabase: () => QuickSQLiteConnection;
  getGamificationSnapshot: (now?: Date) => {badges: Array<{id: string}>};
  replaceAccount: (db: QuickSQLiteConnection, accountId: string) => void;
  wipeLocalData: () => Promise<void>;
};

let directory: string;
let databasePath: string;
let activeConnection: RealSqliteConnection | null;
let activeReset: ((connection?: QuickSQLiteConnection | null) => void) | null;
let originalTz: string | undefined;

function startFreshRuntime(): Runtime {
  jest.resetModules();
  const database =
    require('@core/db/database') as typeof import('@core/db/database');
  const migrations =
    require('@core/db/migrations') as typeof import('@core/db/migrations');
  const repository =
    require('@features/engagement/logic/data/WeeklyGoalBadgeRepository') as typeof import('@features/engagement/logic/data/WeeklyGoalBadgeRepository');
  const gamification =
    require('@features/engagement/logic/gamification') as typeof import('@features/engagement/logic/gamification');
  const localDataWipe =
    require('@core/db/localDataWipe') as typeof import('@core/db/localDataWipe');
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
    diligentKey: repository.DILIGENT_BADGE_LATCH_KEY,
    pendingKey: repository.DILIGENT_BADGE_PENDING_KEY,
    getDatabase: database.getDatabase,
    getGamificationSnapshot: gamification.getGamificationSnapshot,
    replaceAccount: database.executeAccountReplacementTransaction,
    wipeLocalData: localDataWipe.clearAllLocalDatabaseRows,
  };
}

function stopRuntime(): void {
  activeReset?.(null);
  activeConnection?.close();
  activeConnection = null;
  activeReset = null;
}

function readSetting(runtime: Runtime, key: string): string | null {
  const row = runtime
    .getDatabase()
    .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [key])
    .rows?.item(0) as {value?: string} | undefined;
  return row?.value ?? null;
}

function seedEarnedWeek(runtime: Runtime): void {
  for (let index = 0; index < 6; index += 1) {
    const at = `2026-10-${String(6 + index).padStart(2, '0')}T10:00:00.000Z`;
    runtime.getDatabase().execute(
      `INSERT INTO lesson_progress (
        lesson_id, status, started_at, completed_at, revision, tombstone, updated_at
      ) VALUES (?, 'completed', ?, ?, 0, 0, ?);`,
      [`lesson-${index}`, at, at, at],
    );
  }
}

function failLatchWrites(runtime: Runtime): void {
  runtime.connection.raw.exec(`CREATE TRIGGER fail_diligent_latch
    BEFORE INSERT ON app_settings
    WHEN NEW.key = '${runtime.diligentKey}'
    BEGIN
      SELECT RAISE(ABORT, 'injected diligent latch failure');
    END;`);
}

function observeWithPending(runtime: Runtime): void {
  seedEarnedWeek(runtime);
  failLatchWrites(runtime);
  expect(
    runtime
      .getGamificationSnapshot(new Date('2026-10-08T12:00:00.000Z'))
      .badges.map(badge => badge.id),
  ).toContain('diligent');
  expect(readSetting(runtime, runtime.pendingKey)).not.toBeNull();
}

beforeEach(() => {
  originalTz = process.env.TZ;
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ling228-adv-r3-'));
  databasePath = path.join(directory, 'lingobites.sqlite');
  activeConnection = null;
  activeReset = null;
});

afterEach(() => {
  process.env.TZ = originalTz;
  stopRuntime();
  jest.resetModules();
  fs.rmSync(directory, {recursive: true, force: true});
});

it('INV-002: durable pending survives restart, row loss, timezone change, and rollover', () => {
  process.env.TZ = 'Asia/Ho_Chi_Minh';
  const firstRuntime = startFreshRuntime();
  observeWithPending(firstRuntime);
  expect(readSetting(firstRuntime, firstRuntime.diligentKey)).toBeNull();

  firstRuntime.connection.raw.exec('DROP TRIGGER fail_diligent_latch;');
  stopRuntime();
  process.env.TZ = 'America/Bogota';

  const restarted = startFreshRuntime();
  restarted.getDatabase().execute('DELETE FROM lesson_progress;');
  expect(
    restarted
      .getGamificationSnapshot(new Date('2026-10-22T12:00:00.000Z'))
      .badges.map(badge => badge.id),
  ).toContain('diligent');
  expect(readSetting(restarted, restarted.diligentKey)).not.toBeNull();
  expect(readSetting(restarted, restarted.pendingKey)).toBeNull();
});

it('INV-T1: account replacement removes durable pending state', () => {
  const runtime = startFreshRuntime();
  observeWithPending(runtime);

  runtime.replaceAccount(
    runtime.getDatabase(),
    '22222222-2222-4222-8222-222222222222',
  );
  expect(readSetting(runtime, runtime.pendingKey)).toBeNull();
});

it('INV-T1: local-data wipe removes durable pending state', async () => {
  const runtime = startFreshRuntime();
  observeWithPending(runtime);

  await runtime.wipeLocalData();
  expect(readSetting(runtime, runtime.pendingKey)).toBeNull();
});
