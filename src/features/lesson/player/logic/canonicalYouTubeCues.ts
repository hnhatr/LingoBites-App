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

/**
 * Index of the last cued sentence that has started by `positionMs`. Unlike
 * `activeSentenceIndexAt` it bridges gaps between cues, so cards that follow
 * the video never stall while no cue contains the position.
 */
export function startedSentenceIndexAt(
  sentences: LessonSentence[],
  positionMs: number,
): number | null {
  let found: number | null = null;
  for (let index = 0; index < sentences.length; index += 1) {
    const start = sentences[index].start_ms;
    if (start === null) continue;
    if (start > positionMs) break;
    found = index;
  }
  return found;
}

/** `m:ss` label for a cue bound. */
export function formatCueTimestamp(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Cue timestamp for cards; null bounds render as `--:--` (BR-002). */
export function formatCueLabel(ms: number | null): string {
  if (ms === null) return '--:--';
  return formatCueTimestamp(ms);
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

/**
 * Where "loop this sentence" jumps back: the sentence's own end cue, else
 * the next sentence's start. Null when the sentence has no start cue or no
 * end can be found (looping is then not offered).
 */
export function sentenceLoopEndMs(
  sentences: LessonSentence[],
  index: number,
): number | null {
  const sentence = sentences[index];
  if (!sentence || sentence.start_ms === null) return null;
  if (sentence.end_ms !== null && sentence.end_ms > sentence.start_ms) {
    return sentence.end_ms;
  }
  const nextStart = sentences[index + 1]?.start_ms ?? null;
  return nextStart !== null && nextStart > sentence.start_ms ? nextStart : null;
}

/** Playback speeds the study toolbar cycles through, fastest first. */
export const STUDY_PLAYBACK_RATES = [1, 0.75, 0.5] as const;

/** The speed after `rate` in `STUDY_PLAYBACK_RATES` (wraps to 1×). */
export function nextStudyPlaybackRate(rate: number): number {
  const index = STUDY_PLAYBACK_RATES.findIndex(value => value === rate);
  return STUDY_PLAYBACK_RATES[(index + 1) % STUDY_PLAYBACK_RATES.length];
}
