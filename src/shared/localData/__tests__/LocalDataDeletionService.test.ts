import {__resetMockDatabases} from '../../../../test-utils/sqliteMock';
import {resetDatabaseForTests} from '@shared/db/database';
import {open} from 'react-native-quick-sqlite';
import {DB_NAME} from '@shared/db/constants';
import {
  insertSpeakingRecording,
  listSpeakingRecordings,
} from '@shared/db/SpeakingRepository';
import {
  insertPendingChapterAudioAsset,
  listReadyAudioAssets,
  markChapterAudioAssetReady,
} from '@shared/db/AudioAssetRepository';
import {
  clearAllLocalDataWithFiles,
  clearSpeakingLocalData,
} from '../LocalDataDeletionService';
import * as LocalDataWipe from '@shared/db/localDataWipe';
import * as SpeakingRepository from '@shared/db/SpeakingRepository';

describe('LocalDataDeletionService', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
  });

  it('clears speaking metadata and deletes managed recording files', async () => {
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
    insertPendingChapterAudioAsset({
      chapterId: 'ch1',
      asset: {
        id: 'asset-1',
        url: 'https://cdn.example.com/asset-1.mp3',
        bytes: 1024,
        checksum: 'sha256-asset-1',
      },
      now,
    });
    markChapterAudioAssetReady(
      'asset-1',
      '/tmp/chapter-audio.mp3',
      1024,
      now,
    );

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
    insertPendingChapterAudioAsset({
      chapterId: 'ch1',
      asset: {
        id: 'asset-1',
        url: 'https://cdn.example.com/asset-1.mp3',
        bytes: 1024,
        checksum: 'sha256-asset-1',
      },
      now,
    });
    markChapterAudioAssetReady(
      'asset-1',
      '/tmp/chapter-audio.mp3',
      1024,
      now,
    );

    const result = await clearAllLocalDataWithFiles({
      fileDeleter: async () => false,
    });

    expect(result.ok).toBe(false);
    expect(result.dbCleared).toBe(true);
    expect(result.failedFilePaths).toEqual(['/tmp/chapter-audio.mp3']);
    expect(listReadyAudioAssets()).toHaveLength(0);
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
