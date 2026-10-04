import {open} from 'react-native-quick-sqlite';

import {DB_NAME} from '@core/db/constants';
import {resetDatabaseForTests} from '@core/db/database';

import {__resetMockDatabases} from '../../../../../../test-utils/sqliteMock';
import {insertAudioAssetRow} from '@test/support/audioAssetSeed';
import {AUDIO_STATUS} from '../AudioAssetRepository';
import {
  getAudioCacheStats,
  getReadyAudioAsset,
  listAudioAssetLocalPaths,
  listReadyAudioAssets,
} from '../AudioAssetRepository';

const NOW = '2026-09-01T00:00:00.000Z';

describe('AudioAssetRepository', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
  });

  it('getReadyAudioAsset returns null when the asset does not exist', () => {
    expect(getReadyAudioAsset('nonexistent')).toBeNull();
  });

  it('getReadyAudioAsset returns the row for a ready asset', () => {
    insertAudioAssetRow({
      id: 'a1',
      chapterId: 'ch1',
      url: 'https://cdn.example.com/a1.mp3',
      localPath: '/audio/ch1/a1.mp3',
      bytes: 2048,
      checksum: 'sha256-a1',
      downloadStatus: 'ready',
      updatedAt: NOW,
    });
    expect(getReadyAudioAsset('a1')).toMatchObject({
      id: 'a1',
      chapterId: 'ch1',
      localPath: '/audio/ch1/a1.mp3',
      bytes: 2048,
      downloadStatus: AUDIO_STATUS.READY,
    });
  });

  it('listReadyAudioAssets returns only ready rows across chapters', () => {
    insertAudioAssetRow({
      id: 'a1',
      chapterId: 'ch1',
      url: 'https://cdn.example.com/a1.mp3',
      localPath: '/audio/ch1/a1.mp3',
      bytes: 1000,
      checksum: 'sha256-a1',
      downloadStatus: 'ready',
      updatedAt: NOW,
    });
    insertAudioAssetRow({
      id: 'b1',
      chapterId: 'ch2',
      url: 'https://cdn.example.com/b1.mp3',
      checksum: 'sha256-b1',
      updatedAt: NOW,
    });

    const ready = listReadyAudioAssets();
    expect(ready.map(row => row.id)).toEqual(['a1']);
  });

  it('only counts ready rows in cache stats', () => {
    insertAudioAssetRow({
      id: 'a1',
      chapterId: 'ch1',
      url: 'https://cdn.example.com/a1.mp3',
      localPath: '/audio/ch1/a1.mp3',
      bytes: 1000,
      checksum: 'sha256-a1',
      downloadStatus: 'ready',
      updatedAt: NOW,
    });
    insertAudioAssetRow({
      id: 'a2',
      chapterId: 'ch1',
      url: 'https://cdn.example.com/a2.mp3',
      localPath: '/audio/ch1/a2.mp3',
      bytes: 2000,
      checksum: 'sha256-a2',
      downloadStatus: 'ready',
      updatedAt: NOW,
    });
    insertAudioAssetRow({
      id: 'b1',
      chapterId: 'ch2',
      url: 'https://cdn.example.com/b1.mp3',
      checksum: 'sha256-b1',
      updatedAt: NOW,
    });

    expect(getAudioCacheStats()).toEqual({
      chapterCount: 1,
      assetCount: 2,
      readyBytes: 3000,
    });
  });

  it('listAudioAssetLocalPaths returns non-null local paths', () => {
    insertAudioAssetRow({
      id: 'a1',
      chapterId: 'ch1',
      url: 'https://cdn.example.com/a1.mp3',
      localPath: '/audio/ch1/a1.mp3',
      bytes: 1000,
      checksum: 'sha256-a1',
      downloadStatus: 'ready',
      updatedAt: NOW,
    });
    insertAudioAssetRow({
      id: 'a2',
      chapterId: 'ch1',
      url: 'https://cdn.example.com/a2.mp3',
      checksum: 'sha256-a2',
      updatedAt: NOW,
    });

    expect(listAudioAssetLocalPaths()).toEqual(['/audio/ch1/a1.mp3']);
  });
});
