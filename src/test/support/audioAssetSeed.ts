import {getDatabase} from '@core/db/database';

/**
 * Test-only direct-SQL seed for `audio_assets`.
 *
 * Used in the account-isolation harness and unit tests that need a seeded
 * audio row without a production writer (R-003). Never import or call from
 * production code.
 */
export function insertAudioAssetRow({
  id,
  chapterId,
  url,
  localPath = null,
  bytes = 0,
  checksum,
  downloadStatus = 'pending',
  updatedAt,
}: {
  id: string;
  chapterId: string;
  url: string;
  localPath?: string | null;
  bytes?: number;
  checksum: string;
  downloadStatus?: string;
  updatedAt: string;
}): void {
  const db = getDatabase();
  db.execute(
    `INSERT INTO audio_assets (
      id, chapter_id, url, local_path, bytes, checksum, download_status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [id, chapterId, url, localPath, bytes, checksum, downloadStatus, updatedAt],
  );
}
