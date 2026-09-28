import {getDatabase} from '@core/db/database';
import type {
  AudioAssetRecord,
  AudioCacheStats,
  ChapterAudioAsset,
} from '@core/db/types';

export const AUDIO_STATUS = {
  PENDING: 'pending',
  DOWNLOADING: 'downloading',
  READY: 'ready',
  FAILED: 'failed',
} as const;

type AudioAssetRow = {
  id: string;
  chapter_id: string;
  url: string;
  local_path: string | null;
  bytes: number;
  checksum: string;
  download_status: string;
  updated_at: string;
};

function mapAudioAssetRow(row: AudioAssetRow): AudioAssetRecord {
  return {
    id: row.id,
    chapterId: row.chapter_id,
    url: row.url,
    localPath: row.local_path,
    bytes: row.bytes,
    checksum: row.checksum,
    downloadStatus: row.download_status as AudioAssetRecord['downloadStatus'],
    updatedAt: row.updated_at,
  };
}

function rowsToRecords(result: {
  rows?: {length: number; item: (index: number) => unknown};
}): AudioAssetRecord[] {
  const rows = result.rows;
  const items: AudioAssetRecord[] = [];
  if (!rows) {
    return items;
  }
  for (let index = 0; index < rows.length; index += 1) {
    items.push(mapAudioAssetRow(rows.item(index) as AudioAssetRow));
  }
  return items;
}

/** Rows belonging to a chapter, oldest declared asset first. */
export function listChapterAudioAssets(chapterId: string): AudioAssetRecord[] {
  const db = getDatabase();
  const result = db.execute(
    `SELECT * FROM audio_assets WHERE chapter_id = ? ORDER BY datetime(updated_at) ASC, id ASC;`,
    [chapterId],
  );
  return rowsToRecords(result);
}

/** One ready asset by id — used by the offline player before playback. */
export function getReadyAudioAsset(id: string): AudioAssetRecord | null {
  const db = getDatabase();
  const result = db.execute(
    `SELECT * FROM audio_assets WHERE id = ? AND download_status = 'ready' LIMIT 1;`,
    [id],
  );
  const row = result.rows?.item(0) as AudioAssetRow | undefined;
  return row ? mapAudioAssetRow(row) : null;
}

/** All fully-downloaded rows; used for cache accounting and eviction. */
export function listReadyAudioAssets(): AudioAssetRecord[] {
  const db = getDatabase();
  const result = db.execute(
    `SELECT * FROM audio_assets WHERE download_status = 'ready' ORDER BY datetime(updated_at) ASC, chapter_id ASC;`,
  );
  return rowsToRecords(result);
}

export function insertPendingChapterAudioAsset({
  chapterId,
  asset,
  now,
}: {
  chapterId: string;
  asset: ChapterAudioAsset;
  now: string;
}): void {
  const db = getDatabase();
  db.execute(
    `INSERT INTO audio_assets (
      id, chapter_id, url, local_path, bytes, checksum, download_status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      asset.id,
      chapterId,
      asset.url,
      null,
      0,
      asset.checksum,
      AUDIO_STATUS.PENDING,
      now,
    ],
  );
}

/** Manifest metadata changed (checksum/url) without touching download state. */
export function updateChapterAudioAssetMetadata(
  id: string,
  asset: Pick<ChapterAudioAsset, 'url' | 'checksum'>,
  now: string,
): void {
  const db = getDatabase();
  db.execute(
    `UPDATE audio_assets SET url = ?, checksum = ?, updated_at = ? WHERE id = ?;`,
    [asset.url, asset.checksum, now, id],
  );
}

/**
 * Sends a row back to `pending`. Used when a ready file's checksum changed
 * (re-download required) and to recover rows left `downloading` by a crash.
 * `local_path`/`bytes` are cleared so a stale or partial file is never used.
 */
export function markChapterAudioAssetPending(id: string, now: string): void {
  const db = getDatabase();
  db.execute(
    `UPDATE audio_assets
      SET download_status = 'pending', local_path = NULL, bytes = 0, updated_at = ?
      WHERE id = ?;`,
    [now, id],
  );
}

export function markChapterAudioAssetDownloading(
  id: string,
  now: string,
): void {
  const db = getDatabase();
  db.execute(
    `UPDATE audio_assets SET download_status = 'downloading', updated_at = ? WHERE id = ?;`,
    [now, id],
  );
}

export function markChapterAudioAssetReady(
  id: string,
  localPath: string,
  bytes: number,
  now: string,
): void {
  const db = getDatabase();
  db.execute(
    `UPDATE audio_assets
      SET download_status = 'ready', local_path = ?, bytes = ?, updated_at = ?
      WHERE id = ?;`,
    [localPath, bytes, now, id],
  );
}

export function markChapterAudioAssetFailed(id: string, now: string): void {
  const db = getDatabase();
  db.execute(
    `UPDATE audio_assets SET download_status = 'failed', updated_at = ? WHERE id = ?;`,
    [now, id],
  );
}

/**
 * Records that the learner opened the chapter now, so cache eviction can tell
 * which chapters have not been opened in N days.
 */
export function touchChapterAudioOpened(chapterId: string, now: string): void {
  const db = getDatabase();
  db.execute(`UPDATE audio_assets SET updated_at = ? WHERE chapter_id = ?;`, [
    now,
    chapterId,
  ]);
}

/** Local paths for cached chapter audio — collect before deleting metadata. */
export function listAudioAssetLocalPaths(): string[] {
  const db = getDatabase();
  const result = db.execute(
    `SELECT local_path FROM audio_assets WHERE local_path IS NOT NULL AND local_path != '';`,
  );
  const rows = result.rows;
  const filePaths: string[] = [];
  if (rows) {
    for (let index = 0; index < rows.length; index += 1) {
      const localPath = (rows.item(index) as {local_path: string}).local_path;
      if (localPath) {
        filePaths.push(localPath);
      }
    }
  }
  return filePaths;
}

/** Removes one downloaded row. The caller owns deleting the file on disk. */
export function deleteChapterAudioAsset(id: string): void {
  const db = getDatabase();
  db.execute('DELETE FROM audio_assets WHERE id = ?;', [id]);
}

/** Removes all audio rows for a chapter. The caller owns deleting the files. */
export function deleteChapterAudioAssets(chapterId: string): void {
  const db = getDatabase();
  db.execute('DELETE FROM audio_assets WHERE chapter_id = ?;', [chapterId]);
}

/** Current device footprint of downloaded chapter audio (for settings). */
export function getAudioCacheStats(): AudioCacheStats {
  const rows = listReadyAudioAssets();
  const chapterIds = new Set<string>();
  let readyBytes = 0;
  for (const row of rows) {
    chapterIds.add(row.chapterId);
    readyBytes += row.bytes;
  }
  return {
    chapterCount: chapterIds.size,
    assetCount: rows.length,
    readyBytes,
  };
}
