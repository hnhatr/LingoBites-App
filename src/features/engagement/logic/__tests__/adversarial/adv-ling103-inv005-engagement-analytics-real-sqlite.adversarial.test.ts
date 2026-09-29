import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {getGamificationSnapshot} from '@features/engagement/logic/gamification';
import * as analyticsPublic from '@features/analytics';
import * as analyticsRepository from '@features/analytics/logic/data/PilotMetricsRepository';
import * as engagementRepository from '@features/engagement/logic/data/GamificationRepository';
import * as legacyGamificationRepository from '@features/engagement/logic/data/GamificationRepository';
import * as legacyPilotMetricsRepository from '@features/analytics/logic/data/PilotMetricsRepository';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {PRIOR_SCHEMA_403BC52} from '@test/support/adversarial/priorSchema403bc52';
import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

/**
 * LING-103 adversarial review (TASK-014, INV-005). Repositories move into
 * engagement/analytics private folders with legacy `export *` shims. These
 * tests use real SQLite (`node:sqlite`) to ensure upgrade-read of gamification
 * events and pilot-metrics inputs survives restart without duplication or drift
 * between shim, private repo, and Public ports.
 */

const T0 = '2026-09-10T08:00:00.000Z';
const NOW = '2026-09-28T09:00:00.000Z';

let dir: string;
let dbFile: string;
let filesDir: string;

function coldStart(): RealSqliteConnection {
  const connection = openRealSqlite(dbFile);
  resetDatabaseForTests(connection);
  getDatabase();
  return connection;
}

function writeFile(name: string, bytes: string): string {
  const filePath = path.join(filesDir, name);
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  fs.writeFileSync(filePath, bytes);
  return filePath;
}

function count(sql: string, params: string[] = []): number {
  const row = getDatabase().execute(sql, params).rows?.item(0) as {n: number};
  return Number(row.n);
}

function seedPriorInstall(raw: RealSqliteConnection) {
  for (const sql of PRIOR_SCHEMA_403BC52) {
    try {
      raw.execute(sql);
    } catch (error) {
      if (!String((error as Error).message).includes('duplicate column')) {
        throw error;
      }
    }
  }
  const recordingPath = writeFile('recordings/rec-prior.m4a', 'M4A');
  raw.execute(
    `INSERT INTO speaking_recordings (id, activity_id, lesson_id, mode,
      file_path, duration_ms, created_at) VALUES (?, ?, ?, 'shadowing', ?, 1200, ?)`,
    ['rec-prior', 'act-prior', 'lesson-prior', recordingPath, T0],
  );
  raw.execute(
    `INSERT INTO gamification_events (id, event_type, source_event_id, points, created_at)
     VALUES (?, 'review_session_completed', ?, 24, ?)`,
    ['gam-prior', 'session-prior', T0],
  );
  raw.execute(
    `INSERT INTO review_sessions (id, card_id, lesson_id, rating, reviewed_at,
      interval_days, next_review_at, created_at)
     VALUES (?, ?, ?, 'good', ?, 1, ?, ?)`,
    [
      'rev-prior',
      'card-prior',
      'lesson-prior',
      '2026-09-27T10:00:00.000Z',
      '2026-09-28T10:00:00.000Z',
      T0,
    ],
  );
  return {recordingPath};
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ling103-adv-'));
  dbFile = path.join(dir, 'lingobites.sqlite');
  filesDir = path.join(dir, 'Documents');
});

afterEach(() => {
  resetDatabaseForTests(null);
  fs.rmSync(dir, {recursive: true, force: true});
});

describe('LING-103 adversarial: engagement/analytics ownership move', () => {
  it('ADV-001 / INV-005: legacy shims re-export the same module instances', () => {
    const pairs: Array<[string, object, object]> = [
      [
        'GamificationRepository',
        legacyGamificationRepository,
        engagementRepository,
      ],
      [
        'PilotMetricsRepository',
        legacyPilotMetricsRepository,
        analyticsRepository,
      ],
    ];
    for (const [name, legacy, owner] of pairs) {
      const ownerKeys = Object.keys(owner).filter(k => k !== '__esModule');
      const legacyKeys = Object.keys(legacy).filter(k => k !== '__esModule');
      expect({name, keys: legacyKeys.sort()}).toEqual({
        name,
        keys: ownerKeys.sort(),
      });
      for (const key of ownerKeys) {
        expect({
          name,
          key,
          same: (legacy as never)[key] === (owner as never)[key],
        }).toEqual({name, key, same: true});
      }
    }
    expect(analyticsPublic.getCapabilityProgressReport).toBe(
      analyticsRepository.getCapabilityProgressReport,
    );
  });

  it('ADV-002 / INV-005: gamification snapshot and pilot metrics survive upgrade-read without duplication', () => {
    const prior = openRealSqlite(dbFile);
    seedPriorInstall(prior);
    prior.close();

    for (let restart = 0; restart < 3; restart += 1) {
      const db = coldStart();
      runMigrations(getDatabase());

      expect(count('SELECT COUNT(*) AS n FROM gamification_events;')).toBe(1);
      expect(legacyGamificationRepository.listGamificationEvents()).toEqual(
        engagementRepository.listGamificationEvents(),
      );

      const snapshot = getGamificationSnapshot(new Date(NOW));
      expect(snapshot.totalXp).toBe(24);

      const viaPublic = analyticsPublic.getCapabilityProgressReport(NOW);
      expect(viaPublic.sentencesSpokenWithoutLookingCount).toBe(1);
      expect(viaPublic.averageStartToAnswerMs).toBe(1200);
      expect(
        legacyPilotMetricsRepository.getCapabilityProgressReport(NOW),
      ).toEqual(viaPublic);
      expect(viaPublic.retention7DayRate).toBe(100);

      db.close();
    }
  });

  it('ADV-003 / INV-005: gamification write through legacy shim and private repo is the same function (no split identity)', () => {
    expect(legacyGamificationRepository.insertGamificationEvent).toBe(
      engagementRepository.insertGamificationEvent,
    );
    expect(legacyPilotMetricsRepository.getCapabilityProgressReport).toBe(
      analyticsPublic.getCapabilityProgressReport,
    );
  });
});
