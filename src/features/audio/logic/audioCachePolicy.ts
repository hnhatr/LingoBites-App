/**
 * Audio cache utilities (REQ-9, SETE-88).
 *
 * The download-side eviction logic (summarizeReadyAssets, selectChaptersToEvict,
 * selectStaleChapters, isChapterStale and their supporting constants) has been
 * retired with the chapter-audio download chain (LING-249). Only the UI
 * formatting helper is kept here because it is used by the Profile row and
 * exported from the barrel.
 */

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
