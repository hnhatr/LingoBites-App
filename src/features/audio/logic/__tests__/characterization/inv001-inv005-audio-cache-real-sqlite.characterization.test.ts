import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';
import {insertAudioAssetRow} from '@test/support/audioAssetSeed';
import {CHARACTERIZATION_INVARIANTS} from '@test/support/characterization';

import {getReadyAudioAsset} from '../../data/AudioAssetRepository';

const T0 = '2026-09-10T08:00:00.000Z';
const NOW = '2026-09-27T12:00:00.000Z';

function applyPriorSchema(raw: RealSqliteConnection) {
  // Earlier launches now always run on the baseline schema (PR 5 reset a
  // pre-baseline install instead of upgrading it; see schemaBaseline test).
  runMigrations(raw);
}

function seedPriorAudioCache(
  raw: RealSqliteConnection,
  audioPath: string,
  byteLength: number,
) {
  applyPriorSchema(raw);
  raw.execute(
    `INSERT INTO audio_assets (
      id, chapter_id, url, local_path, bytes, checksum, download_status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'ready', ?)`,
    [
      'asset-prior',
      'ch-prior',
      'https://cdn.example.com/prior.mp3',
      audioPath,
      byteLength,
      'sha-prior',
      T0,
    ],
  );
}

let dir: string;
let dbFile: string;
let filesDir: string;

function writeAudioFile(relativePath: string, payload: string): string {
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
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ling101-audio-real-sqlite-'));
  dbFile = path.join(dir, 'lingobites.sqlite');
  filesDir = path.join(dir, 'Documents');
});

afterEach(() => {
  resetDatabaseForTests(null);
  fs.rmSync(dir, {recursive: true, force: true});
});

describe('audio chapter cache (real SQLite / node:sqlite)', () => {
  it(`${CHARACTERIZATION_INVARIANTS.INV_001}: ready audio rows and on-disk bytes survive reopen and idempotent migrations`, () => {
    const payload = 'AUDIO-CACHE-BYTES-LIVE';
    const audioPath = writeAudioFile('chapter-audio/asset-live.mp3', payload);
    let db = coldStart();

    insertAudioAssetRow({
      id: 'asset-live',
      chapterId: 'ch-live',
      url: 'https://cdn.example.com/live.mp3',
      localPath: audioPath,
      bytes: Buffer.byteLength(payload),
      checksum: 'sha-live',
      downloadStatus: 'ready',
      updatedAt: NOW,
    });

    db.close();
    db = coldStart();
    expect(getReadyAudioAsset('asset-live')).toMatchObject({
      id: 'asset-live',
      localPath: audioPath,
      bytes: Buffer.byteLength(payload),
      downloadStatus: 'ready',
    });
    expect(fs.readFileSync(audioPath, 'utf8')).toBe(payload);

    runMigrations(getDatabase());
    expect(getReadyAudioAsset('asset-live')?.id).toBe('asset-live');
    expect(fs.readFileSync(audioPath, 'utf8')).toBe(payload);
    expect(
      (
        getDatabase()
          .execute('SELECT COUNT(*) AS count FROM audio_assets WHERE id = ?;', [
            'asset-live',
          ])
          .rows?.item(0) as {count: number}
      ).count,
    ).toBe(1);
    db.close();
  });

  it(`${CHARACTERIZATION_INVARIANTS.INV_001}: rows written by an earlier launch stay readable with their on-disk bytes`, () => {
    const payload = 'AUDIO-CACHE-BYTES-PRIOR';
    const audioPath = writeAudioFile('chapter-audio/asset-prior.mp3', payload);
    const prior = openRealSqlite(dbFile);
    seedPriorAudioCache(prior, audioPath, Buffer.byteLength(payload));
    prior.close();

    let db = coldStart();
    expect(getReadyAudioAsset('asset-prior')).toMatchObject({
      id: 'asset-prior',
      chapterId: 'ch-prior',
      localPath: audioPath,
      bytes: Buffer.byteLength(payload),
    });
    expect(fs.readFileSync(audioPath, 'utf8')).toBe(payload);
    db.close();

    db = coldStart();
    runMigrations(getDatabase());
    expect(getReadyAudioAsset('asset-prior')?.checksum).toBe('sha-prior');
    expect(fs.readFileSync(audioPath, 'utf8')).toBe(payload);
    db.close();
  });

  it(`${CHARACTERIZATION_INVARIANTS.INV_005}: duplicate pending insert does not create a second ready row for the same asset id`, () => {
    const db = coldStart();
    const dupPayload = 'AUDIO-DUP';
    const dupPath = writeAudioFile('chapter-audio/asset-dup.mp3', dupPayload);

    insertAudioAssetRow({
      id: 'asset-dup',
      chapterId: 'ch-dup',
      url: 'https://cdn.example.com/dup.mp3',
      localPath: dupPath,
      bytes: Buffer.byteLength(dupPayload),
      checksum: 'sha-dup',
      downloadStatus: 'ready',
      updatedAt: NOW,
    });

    try {
      insertAudioAssetRow({
        id: 'asset-dup',
        chapterId: 'ch-dup',
        url: 'https://cdn.example.com/dup-v2.mp3',
        bytes: 0,
        checksum: 'sha-dup-v2',
        updatedAt: NOW,
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
    expect(getReadyAudioAsset('asset-dup')?.localPath).toBe(dupPath);
    expect(fs.readFileSync(dupPath, 'utf8')).toBe(dupPayload);

    db.close();
  });
});
