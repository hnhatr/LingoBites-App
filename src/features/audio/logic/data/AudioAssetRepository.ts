import {getDatabase} from '@core/db/database';
import type {AudioAssetRecord, AudioCacheStats} from '@core/db/types';

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

/** All fully-downloaded rows; used for cache accounting. */
export function listReadyAudioAssets(): AudioAssetRecord[] {
  const db = getDatabase();
  const result = db.execute(
    `SELECT * FROM audio_assets WHERE download_status = 'ready' ORDER BY datetime(updated_at) ASC, chapter_id ASC;`,
  );
  return rowsToRecords(result);
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
