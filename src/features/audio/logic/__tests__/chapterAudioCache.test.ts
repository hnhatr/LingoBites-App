import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {resetDatabaseForTests} from '@shared/db/database';
import {open} from 'react-native-quick-sqlite';
import {DB_NAME} from '@shared/db/constants';
import {
  AUDIO_STATUS,
  insertPendingChapterAudioAsset,
  listChapterAudioAssets,
  markChapterAudioAssetReady,
} from '@features/audio/logic/data/AudioAssetRepository';
import type {ChapterAudioAsset} from '@shared/db/types';
import {ensureChapterAudio} from '../chapterAudioCache';
import type {
  ChapterAudioCacheDeps,
  ChapterAudioDownloader,
  ChapterAudioFileStore,
} from '../chapterAudioCache';
import type {ChapterAudioManifestResult} from '../audioManifestClient';

const NOW = '2026-09-01T00:00:00.000Z';

function asset(
  id: string,
  overrides: Partial<ChapterAudioAsset> = {},
): ChapterAudioAsset {
  return {
    id,
    url: `https://cdn.example.com/${id}.mp3`,
    bytes: 100,
    checksum: `sha256-${id}`,
    ...overrides,
  };
}

function makeManifest(
  chapterId: string,
  assets: ChapterAudioAsset[],
): ChapterAudioManifestResult {
  return {ok: true, manifest: {chapterId, assets}};
}

function makeFileStore() {
  const removedPaths: string[] = [];
  const written: string[] = [];
  const store: ChapterAudioFileStore = {
    writeAsset: async ({chapterId, asset: fileAsset}) => {
      written.push(fileAsset.id);
      return `/audio/${chapterId}/${fileAsset.id}.mp3`;
    },
    removeAsset: async localPath => {
      removedPaths.push(localPath);
    },
  };
  return {store, removedPaths, written};
}

function makeHarness(overrides: Partial<ChapterAudioCacheDeps> = {}) {
  const downloadCalls: string[] = [];
  const {store, removedPaths} = makeFileStore();
  const downloader: ChapterAudioDownloader = {
    download: async ({asset: fileAsset}) => {
      downloadCalls.push(fileAsset.id);
      return {
        data: `bytes-${fileAsset.id}`,
        bytes: fileAsset.bytes,
        checksum: fileAsset.checksum,
      };
    },
  };
  const deps: ChapterAudioCacheDeps = {
    fetchManifest: async () => makeManifest('chapter', []),
    downloader,
    fileStore: store,
    now: () => NOW,
    ...overrides,
  };
  return {deps, downloadCalls, removedPaths};
}

function seedReadyChapter(
  chapterId: string,
  assetId: string,
  bytes: number,
  openedAt: string,
) {
  insertPendingChapterAudioAsset({
    chapterId,
    asset: asset(assetId, {bytes}),
    now: openedAt,
  });
  markChapterAudioAssetReady(
    assetId,
    `/audio/${chapterId}/${assetId}.mp3`,
    bytes,
    openedAt,
  );
}

describe('ensureChapterAudio', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
  });

  it('downloads a new chapter and marks its assets ready with local paths', async () => {
    const {deps, downloadCalls} = makeHarness({
      fetchManifest: async () =>
        makeManifest('ch1', [asset('a1'), asset('a2')]),
    });

    const result = await ensureChapterAudio('ch1', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.outcome).toMatchObject({
      chapterId: 'ch1',
      downloaded: ['a1', 'a2'],
      skipped: [],
      failed: [],
    });
    expect(downloadCalls).toEqual(['a1', 'a2']);
    const rows = listChapterAudioAssets('ch1');
    expect(rows.every(row => row.downloadStatus === AUDIO_STATUS.READY)).toBe(
      true,
    );
    expect(rows.map(row => row.localPath)).toEqual([
      '/audio/ch1/a1.mp3',
      '/audio/ch1/a2.mp3',
    ]);
  });

  it('skips re-download when a ready asset already matches the manifest checksum', async () => {
    const {deps, downloadCalls} = makeHarness({
      fetchManifest: async () => makeManifest('ch1', [asset('a1')]),
    });

    await ensureChapterAudio('ch1', deps);
    const second = await ensureChapterAudio('ch1', deps);

    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(second.outcome).toMatchObject({
      downloaded: [],
      skipped: ['a1'],
    });
    expect(downloadCalls).toEqual(['a1']);
  });

  it('re-downloads an asset when its checksum changed and removes the old file', async () => {
    const first = makeHarness({
      fetchManifest: async () => makeManifest('ch1', [asset('a1')]),
    });
    await ensureChapterAudio('ch1', first.deps);

    const second = makeHarness({
      fetchManifest: async () =>
        makeManifest('ch1', [asset('a1', {checksum: 'sha256-changed'})]),
    });
    const result = await ensureChapterAudio('ch1', second.deps);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.outcome.downloaded).toEqual(['a1']);
    expect(second.downloadCalls).toEqual(['a1']);
    expect(second.removedPaths).toContain('/audio/ch1/a1.mp3');
    const row = listChapterAudioAssets('ch1')[0];
    expect(row.downloadStatus).toBe(AUDIO_STATUS.READY);
    expect(row.checksum).toBe('sha256-changed');
  });

  it('marks a failed download and retries it on the next open without crashing', async () => {
    const {deps, downloadCalls} = makeHarness({
      fetchManifest: async () => makeManifest('ch1', [asset('a1')]),
    });
    const originalDownload = deps.downloader.download;
    deps.downloader.download = async () => {
      throw new Error('network down');
    };

    const first = await ensureChapterAudio('ch1', deps);

    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(first.outcome.failed).toEqual([
      {id: 'a1', errorCode: 'DOWNLOAD_FAILED'},
    ]);
    expect(listChapterAudioAssets('ch1')[0].downloadStatus).toBe(
      AUDIO_STATUS.FAILED,
    );

    deps.downloader.download = originalDownload;
    const second = await ensureChapterAudio('ch1', deps);

    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(second.outcome.downloaded).toEqual(['a1']);
    expect(downloadCalls).toEqual(['a1']);
  });

  it('marks CHECKSUM_MISMATCH when the downloader returns different bytes', async () => {
    const {deps} = makeHarness({
      fetchManifest: async () => makeManifest('ch1', [asset('a1')]),
    });
    deps.downloader.download = async () => ({
      data: 'corrupt',
      bytes: 100,
      checksum: 'sha256-wrong',
    });

    const result = await ensureChapterAudio('ch1', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.outcome.failed).toEqual([
      {id: 'a1', errorCode: 'CHECKSUM_MISMATCH'},
    ]);
    expect(listChapterAudioAssets('ch1')[0].downloadStatus).toBe(
      AUDIO_STATUS.FAILED,
    );
  });

  it('keeps the chapter usable in text mode when the manifest fetch fails', async () => {
    const {deps} = makeHarness({
      fetchManifest: async () => ({
        ok: false,
        errorCode: 'NETWORK_ERROR' as const,
        message: 'offline',
      }),
    });

    const result = await ensureChapterAudio('ch1', deps);

    expect(result).toEqual({
      ok: false,
      errorCode: 'MANIFEST_FETCH_FAILED',
      message: 'offline',
    });
  });

  it('respects the per-chapter cap and reports a failed asset', async () => {
    const {deps} = makeHarness({
      maxBytesPerChapter: 50,
      fetchManifest: async () =>
        makeManifest('ch1', [asset('a1', {bytes: 100})]),
    });

    const result = await ensureChapterAudio('ch1', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.outcome.failed).toEqual([
      {id: 'a1', errorCode: 'PER_CHAPTER_STORAGE_LIMIT'},
    ]);
    expect(listChapterAudioAssets('ch1')[0].downloadStatus).toBe(
      AUDIO_STATUS.FAILED,
    );
  });

  it('prunes chapters not opened in N days when a new chapter is opened', async () => {
    seedReadyChapter('stale', 's1', 200, '2026-07-01T00:00:00.000Z');
    seedReadyChapter('recent', 'r1', 200, '2026-08-25T00:00:00.000Z');
    const {deps, removedPaths} = makeHarness({
      fetchManifest: async () => makeManifest('active', [asset('a1')]),
    });

    const result = await ensureChapterAudio('active', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(removedPaths).toContain('/audio/stale/s1.mp3');
    expect(removedPaths).not.toContain('/audio/recent/r1.mp3');
    expect(result.outcome.evictedBytes).toBe(200);
    expect(listChapterAudioAssets('stale')).toHaveLength(0);
    expect(listChapterAudioAssets('recent')).toHaveLength(1);
  });

  it('evicts recently opened chapters too when stale ones do not free enough space', async () => {
    seedReadyChapter('stale', 's1', 200, '2026-07-01T00:00:00.000Z');
    seedReadyChapter('recent', 'r1', 400, '2026-08-25T00:00:00.000Z');
    const {deps, removedPaths} = makeHarness({
      maxCacheBytes: 1000,
      fetchManifest: async () =>
        makeManifest('active', [asset('a1', {bytes: 700})]),
    });

    const result = await ensureChapterAudio('active', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(removedPaths).toContain('/audio/stale/s1.mp3');
    expect(removedPaths).toContain('/audio/recent/r1.mp3');
    expect(result.outcome.evictedBytes).toBe(600);
    expect(listChapterAudioAssets('recent')).toHaveLength(0);
    expect(listChapterAudioAssets('active')[0].downloadStatus).toBe(
      AUDIO_STATUS.READY,
    );
  });

  it('never evicts the chapter currently being opened', async () => {
    seedReadyChapter('active', 'a1', 500, '2026-08-25T00:00:00.000Z');
    seedReadyChapter('other', 'o1', 500, '2026-08-20T00:00:00.000Z');
    const {deps, removedPaths} = makeHarness({
      maxCacheBytes: 800,
      fetchManifest: async () =>
        makeManifest('active', [asset('a1'), asset('a2', {bytes: 500})]),
    });

    const result = await ensureChapterAudio('active', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(removedPaths).toContain('/audio/other/o1.mp3');
    expect(removedPaths).not.toContain('/audio/active/a1.mp3');
    const activeIds = listChapterAudioAssets('active')
      .map(row => row.id)
      .sort();
    expect(activeIds).toEqual(['a1', 'a2']);
  });
});
