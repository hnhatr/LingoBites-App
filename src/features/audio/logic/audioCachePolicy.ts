import type {AudioAssetRecord, ChapterAudioSummary} from '@shared/db/types';

/**
 * Offline audio cache budget (REQ-9, SETE-88). Storage stays bounded by a
 * device-wide cap plus a per-chapter cap; chapters not opened within
 * `STALE_CHAPTER_DAYS` are evicted first when space is needed. The value N is
 * deliberately a single named constant so the product can tune it in one place.
 */
export const DEFAULT_MAX_CACHE_BYTES = 256 * 1024 * 1024; // 256 MB device-wide
export const DEFAULT_MAX_BYTES_PER_CHAPTER = 64 * 1024 * 1024; // 64 MB per chapter
export const STALE_CHAPTER_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Rolls ready audio rows up per chapter for eviction / accounting decisions. */
export function summarizeReadyAssets(
  rows: AudioAssetRecord[],
): ChapterAudioSummary[] {
  const byChapter = new Map<string, ChapterAudioSummary>();
  for (const row of rows) {
    const existing = byChapter.get(row.chapterId);
    const lastOpenedAt = existing
      ? maxIso(existing.lastOpenedAt, row.updatedAt)
      : row.updatedAt;
    byChapter.set(row.chapterId, {
      chapterId: row.chapterId,
      readyBytes: (existing?.readyBytes ?? 0) + row.bytes,
      assetCount: (existing?.assetCount ?? 0) + 1,
      lastOpenedAt,
    });
  }
  return [...byChapter.values()];
}

function maxIso(a: string | null, b: string): string | null {
  if (a === null) {
    return b;
  }
  return a >= b ? a : b;
}

function lastOpenedMs(summary: ChapterAudioSummary): number {
  if (summary.lastOpenedAt === null) {
    return 0;
  }
  return Date.parse(summary.lastOpenedAt);
}

/** True when a chapter has not been opened within `staleDays`. */
export function isChapterStale(
  summary: ChapterAudioSummary,
  now: string,
  staleDays = STALE_CHAPTER_DAYS,
): boolean {
  if (summary.lastOpenedAt === null) {
    return true;
  }
  const ageDays =
    (Date.parse(now) - Date.parse(summary.lastOpenedAt)) / MS_PER_DAY;
  return ageDays >= staleDays;
}

export function selectStaleChapters(
  chapters: ChapterAudioSummary[],
  now: string,
  staleDays = STALE_CHAPTER_DAYS,
  excludeChapterId?: string,
): ChapterAudioSummary[] {
  return chapters
    .filter(
      summary =>
        summary.chapterId !== excludeChapterId &&
        isChapterStale(summary, now, staleDays),
    )
    .sort((a, b) => lastOpenedMs(a) - lastOpenedMs(b));
}

/**
 * Chooses which chapters to evict so that storing `additionalBytes` more keeps
 * the whole cache under `maxCacheBytes`. Chapters that have not been opened in
 * `staleDays` are evicted first (oldest first); if that is not enough the
 * remaining least-recently-opened chapters are evicted too. The chapter being
 * opened right now is never selected.
 */
export function selectChaptersToEvict({
  chapters,
  activeChapterId,
  additionalBytes,
  now,
  staleDays = STALE_CHAPTER_DAYS,
  maxCacheBytes = DEFAULT_MAX_CACHE_BYTES,
}: {
  chapters: ChapterAudioSummary[];
  activeChapterId: string;
  additionalBytes: number;
  now: string;
  staleDays?: number;
  maxCacheBytes?: number;
}): ChapterAudioSummary[] {
  const totalBytes = chapters.reduce(
    (sum, chapter) => sum + chapter.readyBytes,
    0,
  );
  const neededFree = totalBytes + additionalBytes - maxCacheBytes;
  if (neededFree <= 0) {
    return [];
  }

  const candidates = chapters
    .filter(summary => summary.chapterId !== activeChapterId)
    .sort((a, b) => {
      const aStale = isChapterStale(a, now, staleDays) ? 0 : 1;
      const bStale = isChapterStale(b, now, staleDays) ? 0 : 1;
      if (aStale !== bStale) {
        return aStale - bStale;
      }
      return lastOpenedMs(a) - lastOpenedMs(b);
    });

  const evict: ChapterAudioSummary[] = [];
  let freedBytes = 0;
  for (const chapter of candidates) {
    if (freedBytes >= neededFree) {
      break;
    }
    evict.push(chapter);
    freedBytes += chapter.readyBytes;
  }
  return evict;
}

/** Formats a byte count for the settings UI ("12.4 MB", "0 KB", ...). */
export function formatCacheBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  }
  if (bytes >= 1024) {
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
  }
  return '0 MB';
}
