import {useCallback, useEffect, useRef, useState} from 'react';
import type {YouTubeSegment} from '../../../../shared/schemas/youtube-transcript-v1';

export const TRANSCRIPT_SYNC_POLL_INTERVAL_MS = 250;
// SETE-318: upper bound for one getCurrentTime round trip. The iframe
// answers over the WebView bridge, which can hang forever (e.g. a poll
// injected before the page's player object exists throws in-page, so no
// reply is ever posted). Without a bound, one hung call wedges the poll
// latch below and the transcript never follows a playing clip again.
export const TRANSCRIPT_SYNC_POLL_TIMEOUT_MS = 1_000;
/**
 * SETE-325 (C-1): seeking to a sentence starts playback slightly before its
 * first word so the opening sound is not clipped.
 */
export const TRANSCRIPT_SEEK_COMPENSATION_MS = 300;
/**
 * SETE-345: after a programmatic seek the player briefly reports a time
 * inside the previous sentence (300ms compensation lands before the
 * target start). Polls/ticks inside this window must not drag the
 * highlight backwards off the seek target — that flicker is what fed the
 * loop effect a phantom N-1 → N step and cascaded all the way to 0.
 */
export const TRANSCRIPT_SEEK_SETTLE_MS = 500;
const INTERPOLATION_TICK_MS = 50;

type TimeSample = {
  wallMs: number;
  mediaMs: number;
};

export type TranscriptSyncSegment = Pick<YouTubeSegment, 'start_ms' | 'end_ms'>;

/**
 * Returns the index of the segment that should be highlighted at `timeMs`.
 *
 * In-segment rule: start_ms ≤ timeMs < end_ms.
 * Silence gaps keep the previous segment; time before the first segment is -1;
 * time at or after the last segment's end keeps the last segment.
 */
export function findActiveSegmentIndex(
  segments: readonly TranscriptSyncSegment[],
  timeMs: number,
): number {
  if (segments.length === 0) {
    return -1;
  }

  if (timeMs < segments[0].start_ms) {
    return -1;
  }

  const lastIndex = segments.length - 1;
  if (timeMs >= segments[lastIndex].end_ms) {
    return lastIndex;
  }

  let lo = 0;
  let hi = lastIndex;
  let candidate = -1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segments[mid].start_ms <= timeMs) {
      candidate = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (candidate < 0) {
    return -1;
  }

  if (timeMs < segments[candidate].end_ms) {
    return candidate;
  }

  return candidate;
}

export function interpolateMediaTimeMs(
  previous: TimeSample | null,
  current: TimeSample,
  nowWallMs: number,
): number {
  if (!previous || previous.wallMs >= current.wallMs) {
    return current.mediaMs;
  }

  if (nowWallMs <= current.wallMs) {
    const span = current.wallMs - previous.wallMs;
    if (span <= 0) {
      return current.mediaMs;
    }
    const ratio = (nowWallMs - previous.wallMs) / span;
    return previous.mediaMs + ratio * (current.mediaMs - previous.mediaMs);
  }

  const playbackRate =
    (current.mediaMs - previous.mediaMs) / (current.wallMs - previous.wallMs);
  return current.mediaMs + playbackRate * (nowWallMs - current.wallMs);
}

export interface UseTranscriptSyncOptions {
  segments: readonly YouTubeSegment[];
  getCurrentTimeMs: () => Promise<number>;
  onSeek?: (timeMs: number) => void;
  enabled?: boolean;
}

export interface SeekToIndexOptions {
  /**
   * SETE-345: internal loop / A–B replays seek exactly to `start_ms`
   * (no 300ms compensation) so the replay never lands inside the
   * previous sentence. Manual taps keep the default compensation to
   * avoid clipping the opening sound.
   */
  exact?: boolean;
}

export interface UseTranscriptSyncResult {
  /**
   * Highlight index for the UI. Updated optimistically by seekToIndex so
   * taps feel instant.
   */
  activeIndex: number;
  /**
   * SETE-345: index confirmed by player observations (polls/ticks) only —
   * never moved optimistically by seekToIndex. Loop/duplicate logic must
   * key off this: a stale pre-seek poll re-applying an already-observed
   * index is a state no-op, so it can never retrigger a replay.
   */
  observedIndex: number;
  seekToIndex: (index: number, options?: SeekToIndexOptions) => void;
}

export function useTranscriptSync({
  segments,
  getCurrentTimeMs,
  onSeek,
  enabled = true,
}: UseTranscriptSyncOptions): UseTranscriptSyncResult {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [observedIndex, setObservedIndex] = useState(-1);
  const segmentsRef = useRef(segments);
  const getCurrentTimeMsRef = useRef(getCurrentTimeMs);
  const onSeekRef = useRef(onSeek);
  const previousSampleRef = useRef<TimeSample | null>(null);
  const currentSampleRef = useRef<TimeSample | null>(null);
  const pollInFlightRef = useRef(false);
  const seekTargetRef = useRef(-1);
  const seekSettleUntilRef = useRef(0);
  /**
   * SETE-345: wall time of the last seekToIndex. A poll issued before a
   * seek measures pre-seek playback — when it resolves after the seek it
   * must not overwrite the optimistic seek samples nor retrigger a loop
   * replay for a boundary the replay already handled.
   */
  const lastSeekWallRef = useRef(0);

  segmentsRef.current = segments;
  getCurrentTimeMsRef.current = getCurrentTimeMs;
  onSeekRef.current = onSeek;

  const syncActiveIndexFromMediaTime = useCallback((mediaMs: number) => {
    const nextIndex = findActiveSegmentIndex(segmentsRef.current, mediaMs);
    // SETE-345: ignore backward flicker off a fresh seek target while the
    // player settles. Forward progress at/after the target is still
    // applied so short sentences keep advancing.
    if (
      nextIndex >= 0 &&
      seekTargetRef.current >= 0 &&
      Date.now() < seekSettleUntilRef.current &&
      nextIndex < seekTargetRef.current
    ) {
      return;
    }
    setActiveIndex(current => (current === nextIndex ? current : nextIndex));
    setObservedIndex(current => (current === nextIndex ? current : nextIndex));
  }, []);

  const seekToIndex = useCallback(
    (index: number, options?: SeekToIndexOptions) => {
      const list = segmentsRef.current;
      if (index < 0 || index >= list.length) {
        return;
      }

      let targetMs = Math.max(0, list[index].start_ms);
      if (!options?.exact) {
        const prevEndMs = index > 0 ? list[index - 1].end_ms : 0;
        const safeCompensation = Math.min(
          TRANSCRIPT_SEEK_COMPENSATION_MS,
          Math.max(0, targetMs - prevEndMs),
        );
        targetMs = Math.max(0, targetMs - safeCompensation);
      }
      const wallMs = Date.now();
      previousSampleRef.current = null;
      currentSampleRef.current = {wallMs, mediaMs: targetMs};
      seekTargetRef.current = index;
      seekSettleUntilRef.current = wallMs + TRANSCRIPT_SEEK_SETTLE_MS;
      lastSeekWallRef.current = wallMs;
      setActiveIndex(index);
      onSeekRef.current?.(targetMs);
    },
    [],
  );

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let cancelled = false;
    let watchdogId: ReturnType<typeof setTimeout> | null = null;

    const clearWatchdog = () => {
      if (watchdogId !== null) {
        clearTimeout(watchdogId);
        watchdogId = null;
      }
    };

    const applySample = (mediaMs: number, issuedAt: number) => {
      clearWatchdog();
      pollInFlightRef.current = false;
      if (cancelled) {
        return;
      }
      // SETE-345: drop measurements issued before the last seek — they
      // describe pre-seek playback and must not move the highlight or
      // feed a duplicate loop replay after the seek landed.
      if (issuedAt < lastSeekWallRef.current) {
        return;
      }
      const wallMs = Date.now();
      const previous = currentSampleRef.current;
      previousSampleRef.current = previous;
      currentSampleRef.current = {wallMs, mediaMs};
      syncActiveIndexFromMediaTime(mediaMs);
    };

    const dropPoll = () => {
      clearWatchdog();
      pollInFlightRef.current = false;
    };

    const poll = () => {
      if (pollInFlightRef.current) {
        return;
      }
      pollInFlightRef.current = true;
      // SETE-318: a hung bridge call must never wedge the latch. The
      // watchdog frees the next tick, and a late reply still carries a
      // fresh measurement, so it is applied rather than discarded.
      watchdogId = setTimeout(() => {
        watchdogId = null;
        pollInFlightRef.current = false;
      }, TRANSCRIPT_SYNC_POLL_TIMEOUT_MS);
      let pending: Promise<number>;
      // SETE-345: issue time lets late replies prove they measured
      // post-seek playback (see applySample).
      const issuedAt = Date.now();
      try {
        pending = getCurrentTimeMsRef.current();
      } catch {
        dropPoll();
        return;
      }
      pending.then(mediaMs => applySample(mediaMs, issuedAt), dropPoll);
    };

    poll();
    const pollId = setInterval(poll, TRANSCRIPT_SYNC_POLL_INTERVAL_MS);

    const tickId = setInterval(() => {
      const current = currentSampleRef.current;
      if (!current) {
        return;
      }
      const nowWallMs = Date.now();
      const previous = previousSampleRef.current;
      const estimatedMs =
        previous == null
          ? current.mediaMs + (nowWallMs - current.wallMs)
          : interpolateMediaTimeMs(previous, current, nowWallMs);
      syncActiveIndexFromMediaTime(estimatedMs);
    }, INTERPOLATION_TICK_MS);

    return () => {
      cancelled = true;
      clearWatchdog();
      clearInterval(pollId);
      clearInterval(tickId);
    };
  }, [enabled, segments, syncActiveIndexFromMediaTime]);

  return {activeIndex, observedIndex, seekToIndex};
}
