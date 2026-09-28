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

function seedPriorSpeakingRecording(
  raw: RealSqliteConnection,
  recordingPath: string,
) {
  applyPriorSchema(raw);
  raw.execute(
    `INSERT INTO speaking_recordings (
      id, activity_id, lesson_id, mode, file_path, duration_ms, created_at
    ) VALUES (?, NULL, ?, 'shadowing', ?, 1500, ?)`,
    ['rec-prior', 'lesson-prior', recordingPath, T0],
  );
}

let dir: string;
let dbFile: string;
let filesDir: string;

function writeRecordingFile(relativePath: string, payload: string): string {
  const filePath = path.join(filesDir, relativePath);
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  fs.writeFileSync(filePath, payload);
  return filePath;
}

function coldStart(): RealSqliteConnection {
  const connection = openRealSqlite(dbFile);
  resetDatabaseForTests(connection);
  getDatabase();
  return connection;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ling101-speaking-real-sqlite-'));
  dbFile = path.join(dir, 'lingobites.sqlite');
  filesDir = path.join(dir, 'Documents');
});

afterEach(() => {
  resetDatabaseForTests(null);
  fs.rmSync(dir, {recursive: true, force: true});
});

describe('speaking recordings (real SQLite / node:sqlite)', () => {
  it(`${CHARACTERIZATION_INVARIANTS.INV_001}: recording metadata and on-disk bytes survive reopen and idempotent migrations`, () => {
    const payload = 'SPEAKING-RECORDING-BYTES-LIVE';
    const recordingPath = writeRecordingFile(
      'LingoBitesRecordings/rec-live.m4a',
      payload,
    );
    let db = coldStart();

    insertSpeakingRecording({
      id: 'rec-live',
      lessonId: 'lesson-live',
      mode: 'quick_answer',
      filePath: recordingPath,
      durationMs: 2200,
      createdAt: NOW,
    });

    db.close();
    db = coldStart();
    expect(listSpeakingRecordings('lesson-live')[0]).toMatchObject({
      id: 'rec-live',
      filePath: recordingPath,
      mode: 'quick_answer',
    });
    expect(fs.readFileSync(recordingPath, 'utf8')).toBe(payload);

    runMigrations(getDatabase());
    expect(listSpeakingRecordings('lesson-live')).toHaveLength(1);
    expect(listSpeakingRecordings('lesson-live')[0]?.id).toBe('rec-live');
    expect(fs.readFileSync(recordingPath, 'utf8')).toBe(payload);
    db.close();
  });

  it(`${CHARACTERIZATION_INVARIANTS.INV_001}: 403bc52 speaking_recordings upgrade to head with readable on-disk bytes`, () => {
    const payload = 'SPEAKING-RECORDING-BYTES-PRIOR';
    const recordingPath = writeRecordingFile(
      'LingoBitesRecordings/rec-prior.m4a',
      payload,
    );
    const prior = openRealSqlite(dbFile);
    seedPriorSpeakingRecording(prior, recordingPath);
    prior.close();

    let db = coldStart();
    expect(listSpeakingRecordings('lesson-prior')[0]).toMatchObject({
      id: 'rec-prior',
      filePath: recordingPath,
    });
    expect(fs.readFileSync(recordingPath, 'utf8')).toBe(payload);
    db.close();

    db = coldStart();
    runMigrations(getDatabase());
    expect(listSpeakingRecordings('lesson-prior')[0]?.durationMs).toBe(1500);
    expect(fs.readFileSync(recordingPath, 'utf8')).toBe(payload);
    db.close();
  });

  it(`${CHARACTERIZATION_INVARIANTS.INV_005}: repeated insert with the same recording id does not duplicate rows`, () => {
    const db = coldStart();

    const dupPayload = 'SPEAKING-DUP';
    const dupPath = writeRecordingFile(
      'LingoBitesRecordings/rec-dup.m4a',
      dupPayload,
    );
    insertSpeakingRecording({
      id: 'rec-dup',
      mode: 'shadowing',
      filePath: dupPath,
      durationMs: 900,
      createdAt: NOW,
    });

    try {
      insertSpeakingRecording({
        id: 'rec-dup',
        mode: 'shadowing',
        filePath: writeRecordingFile(
          'LingoBitesRecordings/rec-dup-2.m4a',
          'OTHER',
        ),
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
    expect(fs.readFileSync(dupPath, 'utf8')).toBe(dupPayload);

    db.close();
  });
});
