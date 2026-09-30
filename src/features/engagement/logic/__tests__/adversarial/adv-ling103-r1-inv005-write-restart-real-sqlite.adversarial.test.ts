import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import * as analyticsPublic from '@features/analytics';
import * as legacyPilotMetricsRepository from '@features/analytics/logic/data/PilotMetricsRepository';
import {listGamificationEvents} from '@features/engagement/logic/data/GamificationRepository';
import * as legacyGamificationRepository from '@features/engagement/logic/data/GamificationRepository';
import {getGamificationSnapshot} from '@features/engagement/logic/gamification';
import {startReviewSession} from '@features/engagement/logic/reviewSession';
import {useProgressReport} from '@features/profile/logic/useProgressReport';
import {
  captureErrorEvent,
  insertSpeakingRecording,
} from '@features/speaking/logic/speakingQueryPort';

import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {PRIOR_SCHEMA_403BC52} from '@test/support/adversarial/priorSchema403bc52';
import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

/**
 * LING-103 independent adversarial review r1 (TASK-014, INV-005), real SQLite
 * (`node:sqlite`). Attacks the write paths that now resolve through the moved
 * engagement/analytics repositories: double-submitted review session, cold
 * restarts + re-run migrations, and pilot metrics fed by the speaking query
 * port. Asserts on persisted rows, outbox rows and derived snapshots — not on
 * return codes.
 */

const T0 = '2026-09-10T08:00:00.000Z';
const DAY = '2026-09-27T09:00:00.000Z';
const NOW = '2026-09-28T09:00:00.000Z';

let dir: string;
let dbFile: string;

function coldStart(): RealSqliteConnection {
  const connection = openRealSqlite(dbFile);
  resetDatabaseForTests(connection);
  getDatabase();
  return connection;
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
  raw.execute(
    `INSERT INTO speaking_recordings (id, activity_id, lesson_id, mode,
      file_path, duration_ms, created_at) VALUES (?, ?, ?, 'shadowing', ?, 1000, ?)`,
    ['rec-prior', 'act-prior', 'lesson-prior', '/prior/rec.m4a', T0],
  );
  raw.execute(
    `INSERT INTO gamification_events (id, event_type, source_event_id, points, created_at)
     VALUES (?, 'review_session_completed', ?, 24, ?)`,
    ['gam-prior', 'session-prior', T0],
  );
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ling103-adv-r1-'));
  dbFile = path.join(dir, 'lingobites.sqlite');
  const prior = openRealSqlite(dbFile);
  seedPriorInstall(prior);
  prior.close();
});

afterEach(() => {
  resetDatabaseForTests(null);
  fs.rmSync(dir, {recursive: true, force: true});
});

describe('LING-103 adversarial r1: INV-005 write/restart paths', () => {
  it('ADV-R1-001 / INV-005: double-submitted review session writes exactly one event set + one outbox row each, stable across restarts', () => {
    let db = coldStart();
    const before = getGamificationSnapshot(new Date(NOW));
    expect(before.totalXp).toBe(24);
    expect(before.totalSessions).toBe(1);

    const session = startReviewSession();
    session.record({
      flashcardId: 'card-1',
      rating: 'remembered',
      dueAt: DAY,
      reviewedAt: DAY,
    });
    session.record({
      flashcardId: 'card-2',
      rating: 'forgot',
      dueAt: null,
      reviewedAt: DAY,
    });
    const first = session.finish(DAY);
    const second = session.finish(DAY); // double tap / re-entrant finish
    expect(first).toMatchObject({ok: true, onTimeCount: 1});
    expect(second).toBeNull();
    const xpEarned = (first as {xpEarned: number}).xpEarned;

    const afterWrite = getGamificationSnapshot(new Date(NOW));
    db.close();

    for (let restart = 0; restart < 3; restart += 1) {
      db = coldStart();
      runMigrations(getDatabase());

      // prior row + 1 session_completed + 1 on_time
      expect(count('SELECT COUNT(*) AS n FROM gamification_events;')).toBe(3);
      expect(
        count(
          `SELECT COUNT(*) AS n FROM gamification_events
           WHERE source_event_id = ?;`,
          [session.sessionId],
        ),
      ).toBe(1);
      expect(
        count(
          `SELECT COUNT(*) AS n FROM sync_outbox
           WHERE event_type = 'gamification_events';`,
        ),
      ).toBe(2);
      expect(
        count(
          `SELECT COUNT(*) AS n FROM sync_outbox o
           WHERE o.event_type = 'gamification_events'
             AND NOT EXISTS (SELECT 1 FROM gamification_events g WHERE g.id = o.entity_id);`,
        ),
      ).toBe(0);

      expect(legacyGamificationRepository.listGamificationEvents()).toEqual(
        listGamificationEvents(),
      );
      const snapshot = getGamificationSnapshot(new Date(NOW));
      expect(snapshot).toEqual(afterWrite);
      expect(snapshot.totalXp).toBe(24 + xpEarned);
      expect(snapshot.totalSessions).toBe(2);
      expect(snapshot.totalXp).toBeGreaterThanOrEqual(before.totalXp);

      db.close();
    }
  });

  it('ADV-R1-002 / INV-005: pilot metrics fed via speaking port agree across analytics Public, legacy shim and settings facade, no duplication across restarts', () => {
    let db = coldStart();
    insertSpeakingRecording({
      id: 'rec-new',
      activityId: 'act-new',
      lessonId: 'lesson-new',
      mode: 'quick_answer',
      filePath: '/new/rec.m4a',
      durationMs: 3000,
      createdAt: DAY,
    });
    captureErrorEvent({
      id: 'err-new',
      source: 'speaking',
      category: 'vocabulary',
      activityId: 'act-new',
      lessonId: 'lesson-new',
      reviewFront: 'front',
      reviewBack: 'back',
      createdAt: DAY,
    });
    db.close();

    const facade = useProgressReport();
    let firstExport: unknown = null;
    for (let restart = 0; restart < 3; restart += 1) {
      db = coldStart();
      runMigrations(getDatabase());

      const viaPublic = analyticsPublic.getCapabilityProgressReport(NOW);
      expect(viaPublic.sentencesSpokenWithoutLookingCount).toBe(2);
      expect(viaPublic.averageStartToAnswerMs).toBe(2000);
      expect(viaPublic.beforeAfterRecordings.earliest?.id).toBe('rec-prior');
      expect(viaPublic.beforeAfterRecordings.latest?.id).toBe('rec-new');
      expect(
        legacyPilotMetricsRepository.getCapabilityProgressReport(NOW),
      ).toEqual(viaPublic);
      expect(facade.getCapabilityProgressReport(NOW)).toEqual(viaPublic);

      const exported = analyticsPublic.exportPrivacySafeMetrics(NOW);
      expect(exported.aggregate_metrics.total_recordings_count).toBe(2);
      expect(exported.aggregate_metrics.total_speaking_duration_ms).toBe(4000);
      expect(exported.aggregate_metrics.error_events_by_category).toEqual({
        vocabulary: 1,
      });
      expect(facade.exportPrivacySafeMetrics(NOW)).toEqual(exported);
      expect(
        legacyPilotMetricsRepository.exportPrivacySafeMetrics(NOW),
      ).toEqual(exported);
      expect(JSON.stringify(exported)).not.toContain('/new/rec.m4a');
      if (firstExport === null) {
        firstExport = exported;
      } else {
        expect(exported).toEqual(firstExport);
      }

      db.close();
    }
  });
});
