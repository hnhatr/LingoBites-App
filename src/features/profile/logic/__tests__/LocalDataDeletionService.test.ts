jest.mock('@features/speaking/logic/recordingService', () => ({
  listRecordingsDirectoryFilePaths: jest.fn().mockResolvedValue([]),
  sweepRecordingsDirectory: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@features/speaking/logic/upload/recordingUploadQueue', () => ({
  requestRecordingUploadDrain: jest.fn(),
}));

import {open} from 'react-native-quick-sqlite';

import {listReadyAudioAssets} from '@features/audio/logic/data/AudioAssetRepository';
import {
  insertSpeakingRecording,
  listSpeakingRecordings,
} from '@features/speaking/logic/data/SpeakingRepository';
import {listPendingSyncEvents} from '@features/sync/logic/adapters/SyncOutboxRepository';

import {DB_NAME} from '@core/db/constants';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import * as LocalDataWipe from '@core/db/localDataWipe';
import {runMigrations} from '@core/db/migrations';
import {SPEAKING_ATTEMPTS_EVENT_TYPE} from '@core/sync/speakingAttempts';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {insertAudioAssetRow} from '@test/support/audioAssetSeed';
import * as SpeakingRepository from '../../../speaking/logic/data/SpeakingRepository';
import {
  clearAllLocalDataWithFiles,
  clearSpeakingLocalData,
} from '../LocalDataDeletionService';

describe('LocalDataDeletionService', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
  });

  it('clears speaking metadata and deletes managed recording files', async () => {
    getDatabase().execute(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      [
        'current_account_id',
        '44444444-4444-4444-8444-444444444444',
        '2026-10-04T10:00:00.000Z',
      ],
    );
    const deletedPaths: string[] = [];
    insertSpeakingRecording({
      id: 'rec-1',
      mode: 'shadowing',
      filePath: '/tmp/rec-1.m4a',
      durationMs: 1000,
    });

    const result = await clearSpeakingLocalData({
      fileDeleter: async path => {
        deletedPaths.push(path);
        return true;
      },
    });

    expect(result).toEqual({
      ok: true,
      dbCleared: true,
      failedFilePaths: [],
    });
    expect(deletedPaths).toEqual(['/tmp/rec-1.m4a']);
    expect(listSpeakingRecordings()).toHaveLength(0);
  });

  it('reports partial failure when a recording file cannot be removed', async () => {
    insertSpeakingRecording({
      id: 'rec-1',
      mode: 'shadowing',
      filePath: '/tmp/rec-1.m4a',
      durationMs: 1000,
    });
    insertSpeakingRecording({
      id: 'rec-2',
      mode: 'shadowing',
      filePath: '/tmp/rec-2.m4a',
      durationMs: 1000,
    });

    const result = await clearSpeakingLocalData({
      fileDeleter: async path => path !== '/tmp/rec-2.m4a',
    });

    expect(result.ok).toBe(false);
    expect(result.dbCleared).toBe(true);
    expect(result.failedFilePaths).toEqual(['/tmp/rec-2.m4a']);
    expect(listSpeakingRecordings()).toHaveLength(0);
  });

  it('collects recording and audio paths before clearing database rows', async () => {
    const callOrder: string[] = [];
    const listSpeakingSpy = jest
      .spyOn(SpeakingRepository, 'listSpeakingRecordingFilePaths')
      .mockImplementation(() => {
        callOrder.push('collect-speaking');
        return ['/tmp/rec-1.m4a'];
      });
    const clearDbSpy = jest
      .spyOn(LocalDataWipe, 'clearAllLocalDatabaseRows')
      .mockImplementation(async () => {
        callOrder.push('clear-db');
      });

    await clearAllLocalDataWithFiles({
      fileDeleter: async () => {
        callOrder.push('delete-files');
        return true;
      },
    });

    expect(callOrder).toEqual(['collect-speaking', 'clear-db', 'delete-files']);

    listSpeakingSpy.mockRestore();
    clearDbSpy.mockRestore();
  });

  it('clears all local data and deletes managed recording and audio files', async () => {
    insertSpeakingRecording({
      id: 'rec-1',
      mode: 'shadowing',
      filePath: '/tmp/rec-1.m4a',
      durationMs: 1000,
    });

    const now = '2026-09-08T10:00:00.000Z';
    insertAudioAssetRow({
      id: 'asset-1',
      chapterId: 'ch1',
      url: 'https://cdn.example.com/asset-1.mp3',
      localPath: '/tmp/chapter-audio.mp3',
      bytes: 1024,
      checksum: 'sha256-asset-1',
      downloadStatus: 'ready',
      updatedAt: now,
    });

    const deletedPaths: string[] = [];
    const result = await clearAllLocalDataWithFiles({
      fileDeleter: async path => {
        deletedPaths.push(path);
        return true;
      },
    });

    expect(result).toEqual({
      ok: true,
      dbCleared: true,
      failedFilePaths: [],
    });
    expect(deletedPaths).toEqual(['/tmp/rec-1.m4a', '/tmp/chapter-audio.mp3']);
    expect(listSpeakingRecordings()).toHaveLength(0);
    expect(listReadyAudioAssets()).toHaveLength(0);
  });

  it('reports partial failure when cached audio files cannot be removed', async () => {
    const now = '2026-09-08T10:00:00.000Z';
    insertAudioAssetRow({
      id: 'asset-1',
      chapterId: 'ch1',
      url: 'https://cdn.example.com/asset-1.mp3',
      localPath: '/tmp/chapter-audio.mp3',
      bytes: 1024,
      checksum: 'sha256-asset-1',
      downloadStatus: 'ready',
      updatedAt: now,
    });

    const result = await clearAllLocalDataWithFiles({
      fileDeleter: async () => false,
    });

    expect(result.ok).toBe(false);
    expect(result.dbCleared).toBe(true);
    expect(result.failedFilePaths).toEqual(['/tmp/chapter-audio.mp3']);
    expect(listReadyAudioAssets()).toHaveLength(0);
  });

  it('full wipe keeps current_account_id and enqueues tombstones via afterWipe', async () => {
    __resetMockDatabases();
    const realDb = openRealSqlite(':memory:');
    runMigrations(realDb);
    resetDatabaseForTests(realDb);

    const accountId = '44444444-4444-4444-8444-444444444444';
    getDatabase().execute(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      ['current_account_id', accountId, '2026-10-04T10:00:00.000Z'],
    );
    getDatabase().execute(
      `INSERT INTO speaking_attempts (
        id, lesson_id, sentence_id, mode, practiced_at,
        check_full_sentence, check_key_words, check_rhythm,
        duration_ms, recording_id, revision, updated_at
      ) VALUES ('a1', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'shadowing', '2026-10-04T10:00:00.000Z', 1, 1, 1, 1000, 'a1', 0, '2026-10-04T10:00:00.000Z');`,
    );

    const result = await clearAllLocalDataWithFiles({
      fileDeleter: async () => true,
    });

    expect(result.dbCleared).toBe(true);
    const row = getDatabase()
      .execute('SELECT value FROM app_settings WHERE key = ?;', [
        'current_account_id',
      ])
      .rows?.item(0) as {value?: string};
    expect(row?.value).toBe(accountId);
    const tombstones = listPendingSyncEvents().filter(
      e => e.eventType === SPEAKING_ATTEMPTS_EVENT_TYPE,
    );
    expect(tombstones).toHaveLength(1);
  });

  it('returns dbCleared: false if database clearing throws', async () => {
    const clearDbSpy = jest
      .spyOn(LocalDataWipe, 'clearAllLocalDatabaseRows')
      .mockImplementation(async () => {
        throw new Error('DB error');
      });

    const result = await clearAllLocalDataWithFiles();

    expect(result).toEqual({
      ok: false,
      dbCleared: false,
      failedFilePaths: [],
    });

    clearDbSpy.mockRestore();
  });
});
