import {
  DEFAULT_MAX_BYTES_PER_CHAPTER,
  DEFAULT_MAX_CACHE_BYTES,
  STALE_CHAPTER_DAYS,
  formatCacheBytes,
  isChapterStale,
  selectChaptersToEvict,
  selectStaleChapters,
  summarizeReadyAssets,
} from '../audioCachePolicy';
import type {AudioAssetRecord, ChapterAudioSummary} from '@shared/db/types';

const NOW = '2026-09-01T00:00:00.000Z';

function summary(
  chapterId: string,
  readyBytes: number,
  lastOpenedAt: string | null,
): ChapterAudioSummary {
  return {chapterId, readyBytes, assetCount: 1, lastOpenedAt};
}

function readyRow(
  chapterId: string,
  updatedAt: string,
  bytes = 100,
): AudioAssetRecord {
  return {
    id: `${chapterId}-${updatedAt}`,
    chapterId,
    url: 'https://cdn.example.com/a.mp3',
    localPath: `/audio/${chapterId}/a.mp3`,
    bytes,
    checksum: 'sha256-a',
    downloadStatus: 'ready',
    updatedAt,
  };
}

describe('audioCachePolicy', () => {
  it('exposes bounded defaults with N = 30 days', () => {
    expect(STALE_CHAPTER_DAYS).toBe(30);
    expect(DEFAULT_MAX_BYTES_PER_CHAPTER).toBeLessThan(DEFAULT_MAX_CACHE_BYTES);
  });

  it('rolls ready rows into per-chapter summaries', () => {
    const rows = [
      readyRow('ch1', '2026-08-01T00:00:00.000Z', 100),
      readyRow('ch1', '2026-08-10T00:00:00.000Z', 250),
      readyRow('ch2', '2026-08-05T00:00:00.000Z', 60),
    ];
    const summaries = summarizeReadyAssets(rows);
    expect(summaries).toEqual([
      {
        chapterId: 'ch1',
        readyBytes: 350,
        assetCount: 2,
        lastOpenedAt: '2026-08-10T00:00:00.000Z',
      },
      {
        chapterId: 'ch2',
        readyBytes: 60,
        assetCount: 1,
        lastOpenedAt: '2026-08-05T00:00:00.000Z',
      },
    ]);
  });

  it('treats a chapter not opened in N days as stale', () => {
    expect(
      isChapterStale(summary('ch1', 100, '2026-07-01T00:00:00.000Z'), NOW, 30),
    ).toBe(true);
    expect(
      isChapterStale(summary('ch1', 100, '2026-08-20T00:00:00.000Z'), NOW, 30),
    ).toBe(false);
    expect(isChapterStale(summary('ch1', 100, null), NOW, 30)).toBe(true);
  });

  it('selects stale chapters oldest first, excluding the active chapter', () => {
    const chapters = [
      summary('old', 100, '2026-05-01T00:00:00.000Z'),
      summary('older', 100, '2026-01-01T00:00:00.000Z'),
      summary('active', 100, '2026-01-01T00:00:00.000Z'),
    ];
    const stale = selectStaleChapters(chapters, NOW, 30, 'active');
    expect(stale.map(c => c.chapterId)).toEqual(['older', 'old']);
  });

  it('returns no eviction when the cache has room', () => {
    const chapters = [summary('ch1', 10, '2026-08-01T00:00:00.000Z')];
    const evict = selectChaptersToEvict({
      chapters,
      activeChapterId: 'ch2',
      additionalBytes: 5,
      now: NOW,
      maxCacheBytes: 100,
    });
    expect(evict).toEqual([]);
  });

  it('evicts stale chapters before recently opened ones', () => {
    const chapters = [
      summary('stale', 60, '2026-06-01T00:00:00.000Z'),
      summary('recent', 60, '2026-08-30T00:00:00.000Z'),
    ];
    const evict = selectChaptersToEvict({
      chapters,
      activeChapterId: 'new',
      additionalBytes: 20,
      now: NOW,
      staleDays: 30,
      maxCacheBytes: 100,
    });
    expect(evict.map(c => c.chapterId)).toEqual(['stale']);
  });

  it('falls back to least-recently-opened chapters when stale ones are not enough', () => {
    const chapters = [
      summary('stale', 10, '2026-06-01T00:00:00.000Z'),
      summary('recentOld', 100, '2026-08-20T00:00:00.000Z'),
      summary('recentNew', 100, '2026-08-30T00:00:00.000Z'),
    ];
    const evict = selectChaptersToEvict({
      chapters,
      activeChapterId: 'new',
      additionalBytes: 100,
      now: NOW,
      staleDays: 30,
      maxCacheBytes: 210,
    });
    // stale(10) frees too little, so recentOld(100) is evicted next.
    expect(evict.map(c => c.chapterId)).toEqual(['stale', 'recentOld']);
  });

  it('never evicts the chapter being opened', () => {
    const chapters = [summary('active', 100, '2026-01-01T00:00:00.000Z')];
    const evict = selectChaptersToEvict({
      chapters,
      activeChapterId: 'active',
      additionalBytes: 50,
      now: NOW,
      maxCacheBytes: 100,
    });
    expect(evict).toEqual([]);
  });

  it('formats byte counts for the settings UI', () => {
    expect(formatCacheBytes(0)).toBe('0 MB');
    expect(formatCacheBytes(5 * 1024)).toBe('5 KB');
    expect(formatCacheBytes(12.4 * 1024 * 1024)).toBe('12 MB');
    expect(formatCacheBytes(50 * 1024 * 1024)).toBe('50 MB');
  });
});
