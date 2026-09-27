import * as audioRepository from './data/AudioAssetRepository';
import {
  STALE_CHAPTER_DAYS,
  DEFAULT_MAX_BYTES_PER_CHAPTER,
  DEFAULT_MAX_CACHE_BYTES,
  summarizeReadyAssets,
  selectStaleChapters,
  selectChaptersToEvict,
} from './audioCachePolicy';
import type {ChapterAudioAsset} from '@shared/db/types';
import type {ChapterAudioManifestResult} from './audioManifestClient';

/**
 * Ports for the real download/file work, which is native (device file system)
 * and therefore injected. The cache logic itself stays pure and unit-testable:
 *  - the downloader fetches the asset bytes and returns them already checksum
 *    verified against the manifest entry (content-addressed delivery);
 *  - the file store persists bytes to device storage and returns the local
 *    absolute path that playback later uses.
 */
export type ChapterAudioDownloader = {
  download: (params: {
    chapterId: string;
    asset: ChapterAudioAsset;
  }) => Promise<{data: unknown; bytes: number; checksum: string}>;
};

export type ChapterAudioFileStore = {
  writeAsset: (params: {
    chapterId: string;
    asset: ChapterAudioAsset;
    data: unknown;
  }) => Promise<string>;
  removeAsset: (localPath: string) => Promise<void>;
};

export type ChapterAudioCacheDeps = {
  fetchManifest: (chapterId: string) => Promise<ChapterAudioManifestResult>;
  downloader: ChapterAudioDownloader;
  fileStore: ChapterAudioFileStore;
  now?: () => string;
  staleDays?: number;
  maxBytesPerChapter?: number;
  maxCacheBytes?: number;
};

export type ChapterAudioCacheOutcome = {
  chapterId: string;
  downloaded: string[];
  skipped: string[];
  failed: {id: string; errorCode: string}[];
  evictedBytes: number;
};

export type EnsureChapterAudioResult =
  | {ok: true; outcome: ChapterAudioCacheOutcome}
  | {ok: false; errorCode: 'MANIFEST_FETCH_FAILED'; message: string};

export type AudioCacheErrorCode =
  | 'DOWNLOAD_FAILED'
  | 'CHECKSUM_MISMATCH'
  | 'STORAGE_FULL'
  | 'PER_CHAPTER_STORAGE_LIMIT';

function errorCodeFromError(error: unknown): AudioCacheErrorCode {
  if (error instanceof Error && error.message.includes('CHECKSUM_MISMATCH')) {
    return 'CHECKSUM_MISMATCH';
  }
  return 'DOWNLOAD_FAILED';
}

async function safeRemove(
  fileStore: ChapterAudioFileStore,
  localPath: string,
): Promise<void> {
  try {
    await fileStore.removeAsset(localPath);
  } catch {
    // Best-effort cleanup: a leftover orphan file is a leak, never a crash.
  }
}

/**
 * Makes a chapter's audio playable offline (REQ-9) while keeping storage
 * bounded (ADR-3). Downloading a chapter audio set:
 *
 *  1. touches the chapter as "opened" (drives the stale eviction rule),
 *  2. fetches the server manifest,
 *  3. reconciles local rows with it (adds new, re-marks changed checksums,
 *     removes assets no longer listed),
 *  4. prunes chapters not opened in N days,
 *  5. downloads each non-ready asset under the per-chapter and device-wide
 *     caps, evicting least-recently-opened chapters when space is needed,
 *  6. marks failures with a retry affordance — the chapter stays usable in
 *     text-only mode and never throws into the review flow.
 *
 * Never rejects: callers receive either a manifest failure or a full outcome.
 */
export async function ensureChapterAudio(
  chapterId: string,
  deps: ChapterAudioCacheDeps,
): Promise<EnsureChapterAudioResult> {
  const now = deps.now?.() ?? new Date().toISOString();
  const staleDays = deps.staleDays ?? STALE_CHAPTER_DAYS;
  const maxBytesPerChapter =
    deps.maxBytesPerChapter ?? DEFAULT_MAX_BYTES_PER_CHAPTER;
  const maxCacheBytes = deps.maxCacheBytes ?? DEFAULT_MAX_CACHE_BYTES;
  const manifestById = new Map<string, ChapterAudioAsset>();

  const outcome: ChapterAudioCacheOutcome = {
    chapterId,
    downloaded: [],
    skipped: [],
    failed: [],
    evictedBytes: 0,
  };

  audioRepository.touchChapterAudioOpened(chapterId, now);

  const manifestResult = await deps.fetchManifest(chapterId);
  if (!manifestResult.ok) {
    return {
      ok: false,
      errorCode: 'MANIFEST_FETCH_FAILED',
      message: manifestResult.message,
    };
  }
  for (const asset of manifestResult.manifest.assets) {
    manifestById.set(asset.id, asset);
  }

  const rowsBefore = audioRepository.listChapterAudioAssets(chapterId);
  const manifestIds = new Set(manifestById.keys());

  // Assets no longer listed by the server are removed from the cache.
  for (const row of rowsBefore) {
    if (manifestIds.has(row.id)) {
      continue;
    }
    if (row.localPath) {
      await safeRemove(deps.fileStore, row.localPath);
    }
    audioRepository.deleteChapterAudioAsset(row.id);
  }

  // Upsert manifest rows: add missing, re-download changed checksums, and
  // recover rows a crash left `downloading`.
  const rowsBeforeById = new Map(rowsBefore.map(row => [row.id, row]));
  for (const asset of manifestResult.manifest.assets) {
    const existing = rowsBeforeById.get(asset.id);
    if (!existing) {
      audioRepository.insertPendingChapterAudioAsset({chapterId, asset, now});
      continue;
    }
    if (existing.downloadStatus === 'ready') {
      if (existing.checksum === asset.checksum) {
        outcome.skipped.push(asset.id);
        continue;
      }
      if (existing.localPath) {
        await safeRemove(deps.fileStore, existing.localPath);
      }
      audioRepository.updateChapterAudioAssetMetadata(asset.id, asset, now);
      audioRepository.markChapterAudioAssetPending(asset.id, now);
      continue;
    }
    if (existing.url !== asset.url || existing.checksum !== asset.checksum) {
      audioRepository.updateChapterAudioAssetMetadata(asset.id, asset, now);
    }
    if (existing.downloadStatus === 'downloading') {
      audioRepository.markChapterAudioAssetPending(asset.id, now);
    }
  }

  // Prune chapters not opened in N days regardless of current pressure.
  outcome.evictedBytes += await evictChapters(
    deps,
    selectStaleChapters(
      summarizeReadyAssets(audioRepository.listReadyAudioAssets()),
      now,
      staleDays,
      chapterId,
    ),
  );

  // Download whatever is not ready yet, under both caps.
  for (const row of audioRepository.listChapterAudioAssets(chapterId)) {
    if (row.downloadStatus === 'ready') {
      continue;
    }
    const asset = manifestById.get(row.id);
    if (!asset) {
      continue;
    }

    const summaries = summarizeReadyAssets(
      audioRepository.listReadyAudioAssets(),
    );
    const chapterBytes =
      summaries.find(summary => summary.chapterId === chapterId)?.readyBytes ??
      0;
    const totalReadyBytes = summaries.reduce((sum, s) => sum + s.readyBytes, 0);

    if (chapterBytes + asset.bytes > maxBytesPerChapter) {
      audioRepository.markChapterAudioAssetFailed(asset.id, now);
      outcome.failed.push({
        id: asset.id,
        errorCode: 'PER_CHAPTER_STORAGE_LIMIT',
      });
      continue;
    }

    if (totalReadyBytes + asset.bytes > maxCacheBytes) {
      const toEvict = selectChaptersToEvict({
        chapters: summaries,
        activeChapterId: chapterId,
        additionalBytes: asset.bytes,
        now,
        staleDays,
        maxCacheBytes,
      });
      outcome.evictedBytes += await evictChapters(deps, toEvict);
    }

    const afterSummaries = summarizeReadyAssets(
      audioRepository.listReadyAudioAssets(),
    );
    const afterTotal = afterSummaries.reduce((sum, s) => sum + s.readyBytes, 0);
    if (afterTotal + asset.bytes > maxCacheBytes) {
      audioRepository.markChapterAudioAssetFailed(asset.id, now);
      outcome.failed.push({id: asset.id, errorCode: 'STORAGE_FULL'});
      continue;
    }

    audioRepository.markChapterAudioAssetDownloading(asset.id, now);
    try {
      const downloaded = await deps.downloader.download({chapterId, asset});
      if (downloaded.checksum !== asset.checksum) {
        throw new Error('CHECKSUM_MISMATCH');
      }
      const localPath = await deps.fileStore.writeAsset({
        chapterId,
        asset,
        data: downloaded.data,
      });
      audioRepository.markChapterAudioAssetReady(
        asset.id,
        localPath,
        downloaded.bytes,
        now,
      );
      outcome.downloaded.push(asset.id);
    } catch (error) {
      audioRepository.markChapterAudioAssetFailed(asset.id, now);
      outcome.failed.push({
        id: asset.id,
        errorCode: errorCodeFromError(error),
      });
    }
  }

  return {ok: true, outcome};
}

async function evictChapters(
  deps: ChapterAudioCacheDeps,
  chapters: Array<{chapterId: string; readyBytes: number}>,
): Promise<number> {
  let freedBytes = 0;
  for (const chapter of chapters) {
    const rows = audioRepository.listChapterAudioAssets(chapter.chapterId);
    for (const row of rows) {
      if (row.localPath) {
        await safeRemove(deps.fileStore, row.localPath);
      }
    }
    audioRepository.deleteChapterAudioAssets(chapter.chapterId);
    freedBytes += chapter.readyBytes;
  }
  return freedBytes;
}
