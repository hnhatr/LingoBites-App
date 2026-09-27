import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {getDatabase, resetDatabaseForTests} from '@shared/db/database';
import {runMigrations} from '@shared/db/migrations';
import {
  insertSpeakingRecording,
  listSpeakingRecordings,
} from '../../data/SpeakingRepository';
import {CHARACTERIZATION_INVARIANTS} from '@/test-support/characterization';
import {PRIOR_SCHEMA_403BC52} from '@/test-support/adversarial/priorSchema403bc52';
import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@/test-support/adversarial/realSqlite';

const T0 = '2026-09-10T08:00:00.000Z';
const NOW = '2026-09-27T12:00:00.000Z';

function applyPriorSchema(raw: RealSqliteConnection) {
  for (const sql of PRIOR_SCHEMA_403BC52) {
    try {
      raw.execute(sql);
    } catch (error) {
      if (!String((error as Error).message).includes('duplicate column')) {
        throw error;
      }
    }
  }
}

function seedPriorSpeakingRecording(raw: RealSqliteConnection) {
  applyPriorSchema(raw);
  raw.execute(
    `INSERT INTO speaking_recordings (
      id, activity_id, lesson_id, mode, file_path, duration_ms, created_at
    ) VALUES (?, NULL, ?, 'shadowing', ?, 1500, ?)`,
    ['rec-prior', 'lesson-prior', '/files/prior.m4a', T0],
  );
}

let dir: string;
let dbFile: string;

function coldStart(): RealSqliteConnection {
  const connection = openRealSqlite(dbFile);
  resetDatabaseForTests(connection);
  getDatabase();
  return connection;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ling101-speaking-real-sqlite-'));
  dbFile = path.join(dir, 'lingobites.sqlite');
});

afterEach(() => {
  resetDatabaseForTests(null);
  fs.rmSync(dir, {recursive: true, force: true});
});

describe('speaking recordings (real SQLite / node:sqlite)', () => {
  it(`${CHARACTERIZATION_INVARIANTS.INV_001}: recording metadata survives file reopen and idempotent migrations`, () => {
    let db = coldStart();

    insertSpeakingRecording({
      id: 'rec-live',
      lessonId: 'lesson-live',
      mode: 'quick_answer',
      filePath: '/files/live.m4a',
      durationMs: 2200,
      createdAt: NOW,
    });

    db.close();
    db = coldStart();
    expect(listSpeakingRecordings('lesson-live')[0]).toMatchObject({
      id: 'rec-live',
      filePath: '/files/live.m4a',
      mode: 'quick_answer',
    });

    runMigrations(getDatabase());
    expect(listSpeakingRecordings('lesson-live')).toHaveLength(1);
    db.close();
  });

  it(`${CHARACTERIZATION_INVARIANTS.INV_001}: 403bc52 speaking_recordings upgrade to head and stay readable`, () => {
    const prior = openRealSqlite(dbFile);
    seedPriorSpeakingRecording(prior);
    prior.close();

    let db = coldStart();
    expect(listSpeakingRecordings('lesson-prior')[0]).toMatchObject({
      id: 'rec-prior',
      filePath: '/files/prior.m4a',
    });
    db.close();

    db = coldStart();
    runMigrations(getDatabase());
    expect(listSpeakingRecordings('lesson-prior')[0]?.durationMs).toBe(1500);
    db.close();
  });

  it(`${CHARACTERIZATION_INVARIANTS.INV_005}: repeated insert with the same recording id does not duplicate rows`, () => {
    const db = coldStart();

    insertSpeakingRecording({
      id: 'rec-dup',
      mode: 'shadowing',
      filePath: '/files/dup.m4a',
      durationMs: 900,
      createdAt: NOW,
    });

    try {
      insertSpeakingRecording({
        id: 'rec-dup',
        mode: 'shadowing',
        filePath: '/files/dup-2.m4a',
        durationMs: 900,
        createdAt: NOW,
      });
    } catch {
      // SQLite primary-key violation is acceptable; row count must stay 1.
    }

    const count = (
      getDatabase()
        .execute(
          'SELECT COUNT(*) AS count FROM speaking_recordings WHERE id = ?;',
          ['rec-dup'],
        )
        .rows?.item(0) as {count: number}
    ).count;
    expect(count).toBe(1);
    expect(listSpeakingRecordings()).toHaveLength(1);

    db.close();
  });
});
