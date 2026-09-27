import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {getDatabase, resetDatabaseForTests} from '@shared/db/database';
import {runMigrations} from '@shared/db/migrations';
import * as legacyAudioRepository from '@shared/db/AudioAssetRepository';
import * as legacySpeakingRepository from '@shared/db/SpeakingRepository';
import * as legacyRecordingClient from '@shared/api/recordingClient';
import * as audioRepository from '@modules/audio/data/AudioAssetRepository';
import * as speakingRepository from '@modules/speaking/data/SpeakingRepository';
import * as recordingClient from '@modules/speaking/api/recordingClient';
import * as speakingPublic from '@modules/speaking/speakingQueryPort';
import {getLearnerStateSnapshot} from '@modules/today/todayAdapter';
import {
  clearAllLocalDataWithFiles,
  clearSpeakingLocalData,
} from '@shared/localData/LocalDataDeletionService';
import type {FileDeleter} from '@shared/localData/types';
import {PRIOR_SCHEMA_403BC52} from '@/test-support/adversarial/priorSchema403bc52';
import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@/test-support/adversarial/realSqlite';

/**
 * LING-101 adversarial review (TASK-012, INV-001 / INV-005). The PR moves
 * AudioAssetRepository, SpeakingRepository and recordingClient into private
 * module folders and leaves `export *` shims at the legacy paths. These tests
 * attack the move itself against a real SQLite engine (`node:sqlite`) and real
 * files on disk: split module identity between shim and owner path, upgrade
 * read of a pre-move install, duplicate submit across the two import paths,
 * and explicit-deletion scope (speaking-only vs all local data).
 */

// UI/recording native facade is not under attack; `speakingUiPort` is not imported.
jest.mock('react-native-permissions', () => ({
  check: jest.fn().mockResolvedValue('granted'),
  request: jest.fn().mockResolvedValue('granted'),
  PERMISSIONS: {
    IOS: {MICROPHONE: 'ios.permission.MICROPHONE'},
    ANDROID: {RECORD_AUDIO: 'android.permission.RECORD_AUDIO'},
  },
  RESULTS: {UNAVAILABLE: 'unavailable', GRANTED: 'granted', DENIED: 'denied'},
}));

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

const realFileDeleter: FileDeleter = async filePath => {
  fs.rmSync(filePath, {force: true});
  return !fs.existsSync(filePath);
};

function count(sql: string, params: string[] = []): number {
  const row = getDatabase().execute(sql, params).rows?.item(0) as {
    n: number;
  };
  return Number(row.n);
}

/** Pre-move install: 403bc52 schema plus audio + speaking rows and their files. */
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
  const audioPath = writeFile('LingoBitesAudio/ch-prior/a-prior.mp3', 'MP3');
  const recordingPath = writeFile('recordings/rec-prior.m4a', 'M4A');
  raw.execute(
    `INSERT INTO audio_assets (id, chapter_id, url, local_path, bytes, checksum,
      download_status, updated_at) VALUES (?, ?, ?, ?, 3, ?, 'ready', ?)`,
    [
      'a-prior',
      'ch-prior',
      'https://cdn.example.com/a.mp3',
      audioPath,
      'sha-a',
      T0,
    ],
  );
  raw.execute(
    `INSERT INTO speaking_recordings (id, activity_id, lesson_id, mode,
      file_path, duration_ms, created_at) VALUES (?, ?, ?, 'shadowing', ?, 900, ?)`,
    ['rec-prior', 'act-prior', 'lesson-prior', recordingPath, T0],
  );
  raw.execute(
    `INSERT INTO content_review_items (id, srs_item_id, lesson_id, package_id,
      item_type, source_ref_id, front, back, hint_vi, mastery_state,
      next_review_at, created_at, updated_at)
      VALUES (?, ?, ?, '', 'speaking_error', ?, 'f', 'b', NULL, 'new', ?, ?, ?)`,
    [
      'speaking-error-err-prior',
      'speaking-error-err-prior',
      'lesson-prior',
      'act-prior',
      T0,
      T0,
      T0,
    ],
  );
  raw.execute(
    `INSERT INTO error_events (id, source, category, activity_id, lesson_id,
      review_item_id, created_at) VALUES (?, 'speaking_room', 'listening', ?, ?, ?, ?)`,
    ['err-prior', 'act-prior', 'lesson-prior', 'speaking-error-err-prior', T0],
  );
  return {audioPath, recordingPath};
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ling101-adv-'));
  dbFile = path.join(dir, 'lingobites.sqlite');
  filesDir = path.join(dir, 'Documents');
});

afterEach(() => {
  resetDatabaseForTests(null);
  fs.rmSync(dir, {recursive: true, force: true});
});

describe('LING-101 adversarial: audio/speaking ownership move', () => {
  it('ADV-001 / INV-001 / INV-005: legacy shims re-export the same module instances (no split repository or dropped export)', () => {
    const pairs: Array<[string, object, object]> = [
      ['AudioAssetRepository', legacyAudioRepository, audioRepository],
      ['SpeakingRepository', legacySpeakingRepository, speakingRepository],
      ['recordingClient', legacyRecordingClient, recordingClient],
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
    for (const key of [
      'captureErrorEvent',
      'insertSpeakingRecording',
      'listErrorEvents',
      'listSpeakingRecordings',
    ] as const) {
      expect(speakingPublic[key]).toBe(speakingRepository[key]);
    }
  });

  it('ADV-002 / INV-001 / INV-005: pre-move install is read identically through shim, private repo, Public surface and Today after restart + repeated migrations', () => {
    const prior = openRealSqlite(dbFile);
    const {audioPath, recordingPath} = seedPriorInstall(prior);
    prior.close();

    for (let restart = 0; restart < 3; restart += 1) {
      const db = coldStart();
      runMigrations(getDatabase());

      const viaPublic = speakingPublic.listSpeakingRecordings();
      expect(viaPublic).toEqual([
        {
          id: 'rec-prior',
          activityId: 'act-prior',
          lessonId: 'lesson-prior',
          mode: 'shadowing',
          filePath: recordingPath,
          durationMs: 900,
          createdAt: T0,
        },
      ]);
      expect(legacySpeakingRepository.listSpeakingRecordings()).toEqual(
        viaPublic,
      );
      expect(speakingPublic.listErrorEvents()).toEqual([
        expect.objectContaining({
          id: 'err-prior',
          reviewItemId: 'speaking-error-err-prior',
        }),
      ]);
      expect(
        count(
          "SELECT COUNT(*) AS n FROM content_review_items WHERE item_type = 'speaking_error'",
        ),
      ).toBe(1);

      const audio = audioRepository.getReadyAudioAsset('a-prior');
      expect(audio).toMatchObject({localPath: audioPath, bytes: 3});
      expect(legacyAudioRepository.getReadyAudioAsset('a-prior')).toEqual(
        audio,
      );
      expect(fs.readFileSync(audioPath, 'utf8')).toBe('MP3');
      expect(fs.readFileSync(recordingPath, 'utf8')).toBe('M4A');

      const snapshot = getLearnerStateSnapshot(NOW);
      expect(JSON.stringify(snapshot)).toContain(T0);

      db.close();
    }
  });

  it('ADV-003 / INV-005: duplicate recording / error submit through Public and legacy paths never creates a second row', () => {
    const db = coldStart();
    const recording = {
      id: 'rec-dup',
      lessonId: 'lesson-1',
      mode: 'shadowing' as const,
      filePath: writeFile('recordings/rec-dup.m4a', 'M4A'),
      durationMs: 500,
      createdAt: NOW,
    };
    const errorInput = {
      id: 'err-dup',
      source: 'speaking_room' as const,
      category: 'vocabulary' as const,
      lessonId: 'lesson-1',
      createdAt: NOW,
    };

    speakingPublic.insertSpeakingRecording(recording);
    expect(() =>
      legacySpeakingRepository.insertSpeakingRecording(recording),
    ).toThrow();
    expect(() => speakingPublic.insertSpeakingRecording(recording)).toThrow();

    speakingPublic.captureErrorEvent(errorInput);
    expect(() =>
      legacySpeakingRepository.captureErrorEvent(errorInput),
    ).toThrow();

    db.close();
    coldStart();
    expect(
      count('SELECT COUNT(*) AS n FROM speaking_recordings WHERE id = ?', [
        'rec-dup',
      ]),
    ).toBe(1);
    expect(
      count('SELECT COUNT(*) AS n FROM error_events WHERE id = ?', ['err-dup']),
    ).toBe(1);
    expect(
      count('SELECT COUNT(*) AS n FROM content_review_items WHERE id = ?', [
        'speaking-error-err-dup',
      ]),
    ).toBe(1);
  });

  it('ADV-004 / INV-001: speaking-only deletion removes recordings but keeps audio cache rows/files and lesson review items', async () => {
    const prior = openRealSqlite(dbFile);
    const {audioPath, recordingPath} = seedPriorInstall(prior);
    prior.execute(
      `INSERT INTO content_review_items (id, srs_item_id, lesson_id, package_id,
        item_type, source_ref_id, front, back, hint_vi, mastery_state,
        next_review_at, created_at, updated_at)
        VALUES ('srs-1', 'srs-1', 'lesson-prior', 'pkg', 'vocabulary', 'c', 'f',
        'b', NULL, 'new', ?, ?, ?)`,
      [T0, T0, T0],
    );
    prior.close();
    coldStart();

    const result = await clearSpeakingLocalData({fileDeleter: realFileDeleter});
    expect(result).toEqual({ok: true, dbCleared: true, failedFilePaths: []});
    expect(fs.existsSync(recordingPath)).toBe(false);
    expect(speakingPublic.listSpeakingRecordings()).toEqual([]);
    expect(speakingPublic.listErrorEvents()).toEqual([]);

    expect(fs.readFileSync(audioPath, 'utf8')).toBe('MP3');
    expect(audioRepository.getReadyAudioAsset('a-prior')?.localPath).toBe(
      audioPath,
    );
    expect(
      count('SELECT COUNT(*) AS n FROM content_review_items WHERE id = ?', [
        'srs-1',
      ]),
    ).toBe(1);
  });

  it('ADV-005 / INV-001: explicit all-data deletion removes both recording and cached audio files collected through the moved repositories', async () => {
    const prior = openRealSqlite(dbFile);
    const {audioPath, recordingPath} = seedPriorInstall(prior);
    prior.close();
    coldStart();

    const result = await clearAllLocalDataWithFiles({
      fileDeleter: realFileDeleter,
    });
    expect(result).toEqual({ok: true, dbCleared: true, failedFilePaths: []});
    expect(fs.existsSync(recordingPath)).toBe(false);
    expect(fs.existsSync(audioPath)).toBe(false);
    expect(count('SELECT COUNT(*) AS n FROM speaking_recordings')).toBe(0);
    expect(count('SELECT COUNT(*) AS n FROM audio_assets')).toBe(0);
  });
});
