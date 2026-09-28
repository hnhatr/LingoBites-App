import {__resetMockDatabases} from '../../../../../../test-utils/sqliteMock';
import {resetDatabaseForTests} from '@core/db/database';
import {open} from 'react-native-quick-sqlite';
import {DB_NAME} from '@core/db/constants';
import {AUDIO_STATUS} from '../AudioAssetRepository';
import {
  deleteChapterAudioAsset,
  deleteChapterAudioAssets,
  getAudioCacheStats,
  insertPendingChapterAudioAsset,
  listChapterAudioAssets,
  listReadyAudioAssets,
  markChapterAudioAssetDownloading,
  markChapterAudioAssetFailed,
  markChapterAudioAssetPending,
  markChapterAudioAssetReady,
  touchChapterAudioOpened,
  updateChapterAudioAssetMetadata,
} from '../AudioAssetRepository';
import type {ChapterAudioAsset} from '@core/db/types';

const NOW = '2026-09-01T00:00:00.000Z';

function asset(
  id: string,
  overrides: Partial<ChapterAudioAsset> = {},
): ChapterAudioAsset {
  return {
    id,
    url: `https://cdn.example.com/${id}.mp3`,
    bytes: 1000,
    checksum: `sha256-${id}`,
    ...overrides,
  };
}

describe('AudioAssetRepository', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
  });

  it('inserts a pending row and lists it under the chapter', () => {
    insertPendingChapterAudioAsset({
      chapterId: 'ch1',
      asset: asset('a1'),
      now: NOW,
    });

    const rows = listChapterAudioAssets('ch1');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'a1',
      chapterId: 'ch1',
      url: 'https://cdn.example.com/a1.mp3',
      localPath: null,
      bytes: 0,
      checksum: 'sha256-a1',
      downloadStatus: AUDIO_STATUS.PENDING,
      updatedAt: NOW,
    });
  });

  it('moves a row through downloading -> ready with local path and bytes', () => {
    insertPendingChapterAudioAsset({
      chapterId: 'ch1',
      asset: asset('a1'),
      now: NOW,
    });
    const id = 'a1';

    markChapterAudioAssetDownloading(id, NOW);
    markChapterAudioAssetReady(id, '/audio/ch1/a1.mp3', 2048, NOW);

    const row = listChapterAudioAssets('ch1')[0];
    expect(row.downloadStatus).toBe(AUDIO_STATUS.READY);
    expect(row.localPath).toBe('/audio/ch1/a1.mp3');
    expect(row.bytes).toBe(2048);
  });

  it('marks a row failed and can reset it back to pending for a retry', () => {
    insertPendingChapterAudioAsset({
      chapterId: 'ch1',
      asset: asset('a1'),
      now: NOW,
    });

    markChapterAudioAssetFailed('a1', NOW);
    expect(listChapterAudioAssets('ch1')[0].downloadStatus).toBe(
      AUDIO_STATUS.FAILED,
    );

    markChapterAudioAssetPending('a1', NOW);
    const row = listChapterAudioAssets('ch1')[0];
    expect(row.downloadStatus).toBe(AUDIO_STATUS.PENDING);
    expect(row.localPath).toBeNull();
    expect(row.bytes).toBe(0);
  });

  it('updates manifest metadata (url/checksum) without touching status', () => {
    insertPendingChapterAudioAsset({
      chapterId: 'ch1',
      asset: asset('a1'),
      now: NOW,
    });
    updateChapterAudioAssetMetadata(
      'a1',
      {url: 'https://cdn.example.com/new.mp3', checksum: 'sha256-new'},
      NOW,
    );

    const row = listChapterAudioAssets('ch1')[0];
    expect(row.url).toBe('https://cdn.example.com/new.mp3');
    expect(row.checksum).toBe('sha256-new');
    expect(row.downloadStatus).toBe(AUDIO_STATUS.PENDING);
  });

  it('only counts ready rows in cache stats', () => {
    insertPendingChapterAudioAsset({
      chapterId: 'ch1',
      asset: asset('a1'),
      now: NOW,
    });
    insertPendingChapterAudioAsset({
      chapterId: 'ch1',
      asset: asset('a2'),
      now: NOW,
    });
    insertPendingChapterAudioAsset({
      chapterId: 'ch2',
      asset: asset('b1'),
      now: NOW,
    });

    markChapterAudioAssetReady('a1', '/audio/ch1/a1.mp3', 1000, NOW);
    markChapterAudioAssetReady('a2', '/audio/ch1/a2.mp3', 2000, NOW);

    expect(getAudioCacheStats()).toEqual({
      chapterCount: 1,
      assetCount: 2,
      readyBytes: 3000,
    });
  });

  it('lists ready rows across chapters for eviction decisions', () => {
    insertPendingChapterAudioAsset({
      chapterId: 'ch1',
      asset: asset('a1'),
      now: NOW,
    });
    insertPendingChapterAudioAsset({
      chapterId: 'ch2',
      asset: asset('b1'),
      now: NOW,
    });
    markChapterAudioAssetReady('a1', '/audio/ch1/a1.mp3', 1000, NOW);

    const ready = listReadyAudioAssets();
    expect(ready.map(row => row.chapterId).sort()).toEqual(['ch1']);
  });

  it('touches chapter rows so eviction can tell when a chapter was opened', () => {
    insertPendingChapterAudioAsset({
      chapterId: 'ch1',
      asset: asset('a1'),
      now: NOW,
    });
    const later = '2026-09-05T00:00:00.000Z';
    touchChapterAudioOpened('ch1', later);

    expect(listChapterAudioAssets('ch1')[0].updatedAt).toBe(later);
  });

  it('deletes a single asset row and whole-chapter rows', () => {
    insertPendingChapterAudioAsset({
      chapterId: 'ch1',
      asset: asset('a1'),
      now: NOW,
    });
    insertPendingChapterAudioAsset({
      chapterId: 'ch1',
      asset: asset('a2'),
      now: NOW,
    });
    insertPendingChapterAudioAsset({
      chapterId: 'ch2',
      asset: asset('b1'),
      now: NOW,
    });

    deleteChapterAudioAsset('a1');
    expect(listChapterAudioAssets('ch1').map(row => row.id)).toEqual(['a2']);

    deleteChapterAudioAssets('ch1');
    expect(listChapterAudioAssets('ch1')).toHaveLength(0);
    expect(listChapterAudioAssets('ch2')).toHaveLength(1);
  });
});
