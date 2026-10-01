import type {LessonSentence} from '@core/schemas/lesson';

/**
 * YouTube cue helpers for the canonical player (LING-149 TASK-007, FR-003).
 *
 * Pure functions over the snapshot sentence core: the active cue at a
 * playback position, timestamp formatting, and cue-bounds validation
 * (`start_ms < end_ms <= duration_ms`). The video itself is never
 * downloaded (FR-016); cues only drive highlight and seek.
 */

/** Index of the sentence whose cue contains `positionMs`, or null. */
export function activeSentenceIndexAt(
  sentences: LessonSentence[],
  positionMs: number,
): number | null {
  for (let index = 0; index < sentences.length; index += 1) {
    const sentence = sentences[index];
    if (sentence.start_ms === null || sentence.end_ms === null) continue;
    if (positionMs >= sentence.start_ms && positionMs < sentence.end_ms) {
      return index;
    }
  }
  return null;
}

/** `m:ss` label for a cue bound. */
export function formatCueTimestamp(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * True when every cued sentence satisfies `0 <= start_ms < end_ms` and stays
 * within the video duration. Uncued (non-YouTube) sentences are ignored.
 */
export function areCuesBoundedByDuration(
  sentences: LessonSentence[],
  durationMs: number,
): boolean {
  for (const sentence of sentences) {
    if (sentence.start_ms === null || sentence.end_ms === null) continue;
    if (sentence.start_ms < 0) return false;
    if (sentence.end_ms === null || sentence.start_ms >= sentence.end_ms) {
      return false;
    }
    if (sentence.end_ms > durationMs) return false;
  }
  return true;
}
