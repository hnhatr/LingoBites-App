/**
 * SETE-332 (TASK-5): Pure logic helpers for Tools popup, A-B loop, sentence
 * repeat, dictation validation, dots pagination, and tools badge state.
 */

import type {YouTubePlaybackRate} from './playbackRate';

export const SENTENCE_LOOP_OPTIONS = [1, 3, 5, Infinity] as const;
export type SentenceLoopCount = (typeof SENTENCE_LOOP_OPTIONS)[number];

export const MAX_DOTS_SENTENCE_COUNT = 10;
export const CARD_SCROLL_TOP_THRESHOLD_PT = 40;
export const TOAST_DURATION_MS = 1600;
export const AB_LOOP_OVERSHOOT_MS = 80;

/**
 * Check whether dots pagination should be shown (spec: <= 10 sentences only).
 */
export function shouldShowDots(sentenceCount: number): boolean {
  return sentenceCount > 0 && sentenceCount <= MAX_DOTS_SENTENCE_COUNT;
}

/**
 * Format loop count label for display: 1, 3, 5, or '∞'.
 */
export function formatLoopLabel(loop: SentenceLoopCount): string {
  return loop === Infinity ? '∞' : String(loop);
}

/**
 * Cycle to the next loop option.
 */
export function nextLoopOption(current: SentenceLoopCount): SentenceLoopCount {
  const index = SENTENCE_LOOP_OPTIONS.indexOf(current);
  const nextIndex = (index + 1) % SENTENCE_LOOP_OPTIONS.length;
  return SENTENCE_LOOP_OPTIONS[nextIndex];
}

/**
 * Tools button amber badge is active when loop > 1, speed != 1.0x, or A-B loop is on.
 */
export function toolsBadgeActive(
  loop: SentenceLoopCount = 1,
  speed: YouTubePlaybackRate = 1,
  abActive: boolean = false,
): boolean {
  return (loop !== 1 && loop != null) || speed !== 1 || abActive;
}

/**
 * A-B loop boundary wrap check with YouTube overshoot tolerance.
 * Returns startMs to seek to if currentTimeMs exceeded endMs + overshoot, else null.
 */
export function abWrap(
  currentTimeMs: number,
  startMs: number | null | undefined,
  endMs: number | null | undefined,
  overshootMs: number = AB_LOOP_OVERSHOOT_MS,
): number | null {
  if (startMs == null || endMs == null) {
    return null;
  }
  return currentTimeMs > endMs + overshootMs ? startMs : null;
}

/**
 * Normalize sentence text for dictation check (D-2: local on-the-spot comparison).
 * Trims whitespace, lowercases, and strips surrounding punctuation.
 */
export function normalizeForDictation(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if the user's typed dictation matches the target sentence.
 */
export function checkDictation(
  input: string,
  targetSentence: string,
): {correct: boolean; message: string} {
  const normalizedInput = normalizeForDictation(input);
  const normalizedTarget = normalizeForDictation(targetSentence);

  if (!normalizedInput) {
    return {
      correct: false,
      message: 'Vui lòng gõ nội dung câu trước khi kiểm tra.',
    };
  }

  const correct = normalizedInput === normalizedTarget;
  return {
    correct,
    message: correct ? '✓ Chính xác!' : 'Chưa đúng, nghe lại và thử tiếp.',
  };
}
