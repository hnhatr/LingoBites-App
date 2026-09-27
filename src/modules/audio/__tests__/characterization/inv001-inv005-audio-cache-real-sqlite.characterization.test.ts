import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {getDatabase, resetDatabaseForTests} from '@shared/db/database';
import {runMigrations} from '@shared/db/migrations';
import {
  getReadyAudioAsset,
  insertPendingChapterAudioAsset,
  markChapterAudioAssetReady,
} from '../../data/AudioAssetRepository';
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

function seedPriorAudioCache(raw: RealSqliteConnection) {
  applyPriorSchema(raw);
  raw.execute(
    `INSERT INTO audio_assets (
      id, chapter_id, url, local_path, bytes, checksum, download_status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'ready', ?)`,
    [
      'asset-prior',
      'ch-prior',
      'https://cdn.example.com/prior.mp3',
      '/files/prior.mp3',
      2048,
      'sha-prior',
      T0,
    ],
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
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ling101-audio-real-sqlite-'));
  dbFile = path.join(dir, 'lingobites.sqlite');
});

afterEach(() => {
  resetDatabaseForTests(null);
  fs.rmSync(dir, {recursive: true, force: true});
});

describe('audio chapter cache (real SQLite / node:sqlite)', () => {
  it(`${CHARACTERIZATION_INVARIANTS.INV_001}: ready audio rows survive file reopen and idempotent migrations`, () => {
    let db = coldStart();

    insertPendingChapterAudioAsset({
      chapterId: 'ch-live',
      asset: {
        id: 'asset-live',
        url: 'https://cdn.example.com/live.mp3',
        bytes: 0,
        checksum: 'sha-live',
      },
      now: NOW,
    });
    markChapterAudioAssetReady('asset-live', '/files/live.mp3', 8192, NOW);

    db.close();
    db = coldStart();
    expect(getReadyAudioAsset('asset-live')).toMatchObject({
      id: 'asset-live',
      localPath: '/files/live.mp3',
      bytes: 8192,
      downloadStatus: 'ready',
    });

    runMigrations(getDatabase());
    expect(getReadyAudioAsset('asset-live')?.localPath).toBe('/files/live.mp3');
    db.close();
  });

  it(`${CHARACTERIZATION_INVARIANTS.INV_001}: 403bc52 audio_assets upgrade to head and stay readable`, () => {
    const prior = openRealSqlite(dbFile);
    seedPriorAudioCache(prior);
    prior.close();

    let db = coldStart();
    expect(getReadyAudioAsset('asset-prior')).toMatchObject({
      id: 'asset-prior',
      chapterId: 'ch-prior',
      localPath: '/files/prior.mp3',
      bytes: 2048,
    });
    db.close();

    db = coldStart();
    runMigrations(getDatabase());
    expect(getReadyAudioAsset('asset-prior')?.checksum).toBe('sha-prior');
    db.close();
  });

  it(`${CHARACTERIZATION_INVARIANTS.INV_005}: duplicate pending insert does not create a second ready row for the same asset id`, () => {
    const db = coldStart();

    insertPendingChapterAudioAsset({
      chapterId: 'ch-dup',
      asset: {
        id: 'asset-dup',
        url: 'https://cdn.example.com/dup.mp3',
        bytes: 0,
        checksum: 'sha-dup',
      },
      now: NOW,
    });
    markChapterAudioAssetReady('asset-dup', '/files/dup.mp3', 1024, NOW);

    try {
      insertPendingChapterAudioAsset({
        chapterId: 'ch-dup',
        asset: {
          id: 'asset-dup',
          url: 'https://cdn.example.com/dup-v2.mp3',
          bytes: 0,
          checksum: 'sha-dup-v2',
        },
        now: NOW,
      });
    } catch {
      // SQLite primary-key violation is acceptable; row count must stay 1.
    }

    const rows = getDatabase()
      .execute('SELECT COUNT(*) AS count FROM audio_assets WHERE id = ?;', [
        'asset-dup',
      ])
      .rows?.item(0) as {count: number};
    expect(rows.count).toBe(1);
    expect(getReadyAudioAsset('asset-dup')?.localPath).toBe('/files/dup.mp3');

    db.close();
  });
});
