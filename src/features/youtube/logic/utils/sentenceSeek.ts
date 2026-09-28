/**
 * SETE-328 (TASK-1): pure sentence-seek helpers for the compact control bar
 * and the mini player.
 *
 * Sentence timestamps are approximate (interpolated), so scrubbing snaps to
 * the nearest sentence start within ±0.4s; the actual seek reuses the merged
 * `seekToIndex` compensation (-0.3s, TRANSCRIPT_SEEK_COMPENSATION_MS) and is
 * intentionally not duplicated here.
 */

export const SENTENCE_SNAP_TOLERANCE_S = 0.4;

/** Mini player appears once the player block scrolled strictly past this. */
export const MINI_PLAYER_SCROLL_RATIO = 0.5;

/**
 * Compact screens (< 700pt tall) collapse to the mini player as soon as the
 * player block starts scrolling off instead of waiting for the 50% mark.
 */
export const MINI_PLAYER_SMALL_SCREEN_HEIGHT_PT = 700;

export type SeekSentenceBoundary = {
  start_ms: number;
};

/**
 * Snap a raw scrub position (seconds) to the nearest sentence start within
 * ±tolerance. Snaps to sentence STARTS only — the only meaningful replay
 * points. Returns the raw position when nothing is in range.
 * The result is always >= 0.
 */
export function snapSeekToSentence(
  rawTimeS: number,
  sentences: readonly SeekSentenceBoundary[],
  toleranceS: number = SENTENCE_SNAP_TOLERANCE_S,
): number {
  if (sentences.length === 0) {
    return Math.max(0, rawTimeS);
  }
  // Boundary seconds derived from integer ms still carry binary float noise
  // (e.g. 5 - 4.6 > 0.4), so an exact ±0.4s edge would otherwise miss.
  const EPSILON_S = 1e-9;
  let best: number | null = null;
  for (const sentence of sentences) {
    const boundary = sentence.start_ms / 1000;
    if (Math.abs(rawTimeS - boundary) <= toleranceS + EPSILON_S) {
      if (
        best === null ||
        Math.abs(rawTimeS - boundary) < Math.abs(rawTimeS - best)
      ) {
        best = boundary;
      }
    }
  }
  return Math.max(0, best === null ? rawTimeS : best);
}

/** Remaining time rendered as `-mm:ss`, clamped at zero. */
export function formatRemaining(totalS: number, currentS: number): string {
  const rest = Math.max(0, Math.round(totalS - currentS));
  const mm = String(Math.floor(rest / 60)).padStart(2, '0');
  const ss = String(rest % 60).padStart(2, '0');
  return `-${mm}:${ss}`;
}

/** Absolute time rendered as `mm:ss` (mini player `Câu N/M · mm:ss`). */
export function formatElapsed(currentS: number): string {
  const total = Math.max(0, Math.floor(currentS));
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** `Câu N/M` label (N is 1-based). */
export function formatSentenceLabel(index: number, total: number): string {
  return `Câu ${index + 1}/${total}`;
}

export type MiniPlayerVisibility = {
  /** Pixels of the player block already scrolled past the top edge. */
  scrolledPastPx: number;
  playerHeightPx: number;
  windowHeightPt: number;
};

/**
 * Mini player shows only once scrolled STRICTLY past the threshold: 50% of
 * the player block on regular screens, any scroll at all on compact screens.
 */
export function shouldShowMiniPlayer({
  scrolledPastPx,
  playerHeightPx,
  windowHeightPt,
}: MiniPlayerVisibility): boolean {
  if (!(playerHeightPx > 0)) {
    return false;
  }
  if (windowHeightPt < MINI_PLAYER_SMALL_SCREEN_HEIGHT_PT) {
    return scrolledPastPx > 0;
  }
  return scrolledPastPx > playerHeightPx * MINI_PLAYER_SCROLL_RATIO;
}
