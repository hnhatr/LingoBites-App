import React, {useEffect} from 'react';
import renderer, {act} from 'react-test-renderer';
import type {YouTubeSegment} from '@core/schemas/youtube-transcript-v1';
import {
  findActiveSegmentIndex,
  interpolateMediaTimeMs,
  TRANSCRIPT_SEEK_COMPENSATION_MS,
  TRANSCRIPT_SEEK_SETTLE_MS,
  TRANSCRIPT_SYNC_POLL_INTERVAL_MS,
  TRANSCRIPT_SYNC_POLL_TIMEOUT_MS,
  useTranscriptSync,
  type UseTranscriptSyncResult,
} from '../useTranscriptSync';

function makeSegment(
  index: number,
  start_ms: number,
  end_ms: number,
): YouTubeSegment {
  return {
    id: `seg-${index}`,
    index,
    start_ms,
    end_ms,
    en: `line ${index}`,
    vi: '',
    ipa: '',
  };
}

const SAMPLE_SEGMENTS = [
  makeSegment(0, 0, 3_200),
  makeSegment(1, 3_200, 6_100),
  makeSegment(2, 7_000, 9_500),
];

describe('findActiveSegmentIndex', () => {
  it('returns -1 for empty segments', () => {
    expect(findActiveSegmentIndex([], 1_000)).toBe(-1);
  });

  it('returns -1 when time is before the first segment', () => {
    expect(findActiveSegmentIndex(SAMPLE_SEGMENTS, -1)).toBe(-1);
    expect(findActiveSegmentIndex(SAMPLE_SEGMENTS, 0)).toBe(0);
    expect(findActiveSegmentIndex(SAMPLE_SEGMENTS, 50)).toBe(0);
  });

  it('uses start_ms inclusive and end_ms exclusive', () => {
    expect(findActiveSegmentIndex(SAMPLE_SEGMENTS, 3_199)).toBe(0);
    expect(findActiveSegmentIndex(SAMPLE_SEGMENTS, 3_200)).toBe(1);
    expect(findActiveSegmentIndex(SAMPLE_SEGMENTS, 6_099)).toBe(1);
    expect(findActiveSegmentIndex(SAMPLE_SEGMENTS, 6_100)).toBe(1);
    expect(findActiveSegmentIndex(SAMPLE_SEGMENTS, 7_000)).toBe(2);
  });

  it('keeps the previous segment during silence gaps', () => {
    expect(findActiveSegmentIndex(SAMPLE_SEGMENTS, 6_500)).toBe(1);
    expect(findActiveSegmentIndex(SAMPLE_SEGMENTS, 6_999)).toBe(1);
  });

  it('keeps the last segment after playback passes the final end', () => {
    expect(findActiveSegmentIndex(SAMPLE_SEGMENTS, 9_500)).toBe(2);
    expect(findActiveSegmentIndex(SAMPLE_SEGMENTS, 60_000)).toBe(2);
  });
});

describe('interpolateMediaTimeMs', () => {
  it('linearly interpolates between two samples', () => {
    const previous = {wallMs: 0, mediaMs: 0};
    const current = {wallMs: 250, mediaMs: 250};
    expect(interpolateMediaTimeMs(previous, current, 125)).toBe(125);
  });
});

type HarnessProps = {
  segments: readonly YouTubeSegment[];
  getCurrentTimeMs: () => Promise<number>;
  onSeek?: (timeMs: number) => void;
  onResult: (result: UseTranscriptSyncResult) => void;
};

function TranscriptSyncHarness({
  segments,
  getCurrentTimeMs,
  onSeek,
  onResult,
}: HarnessProps) {
  const result = useTranscriptSync({segments, getCurrentTimeMs, onSeek});
  useEffect(() => {
    onResult(result);
  }, [onResult, result]);
  return null;
}

describe('useTranscriptSync', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-10T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function renderHarness(
    getCurrentTimeMs: () => Promise<number>,
    segments: readonly YouTubeSegment[] = SAMPLE_SEGMENTS,
    onSeek?: (timeMs: number) => void,
  ) {
    let latest: UseTranscriptSyncResult | null = null;

    await act(async () => {
      renderer.create(
        <TranscriptSyncHarness
          segments={segments}
          getCurrentTimeMs={getCurrentTimeMs}
          onSeek={onSeek}
          onResult={result => {
            latest = result;
          }}
        />,
      );
      await Promise.resolve();
    });

    const read = () => {
      if (!latest) {
        throw new Error('hook result not ready');
      }
      return latest;
    };

    return {read};
  }

  it('tracks the active segment from polled playback time within 300ms', async () => {
    let mediaMs = 0;
    const {read} = await renderHarness(async () => mediaMs);

    await act(async () => {
      jest.advanceTimersByTime(TRANSCRIPT_SYNC_POLL_INTERVAL_MS);
      await Promise.resolve();
    });
    expect(read().activeIndex).toBe(0);

    mediaMs = 3_200;
    await act(async () => {
      jest.advanceTimersByTime(TRANSCRIPT_SYNC_POLL_INTERVAL_MS);
      await Promise.resolve();
    });
    expect(read().activeIndex).toBe(1);

    mediaMs = 6_800;
    await act(async () => {
      jest.advanceTimersByTime(TRANSCRIPT_SYNC_POLL_INTERVAL_MS);
      await Promise.resolve();
    });
    expect(read().activeIndex).toBe(1);
  });

  it('extrapolates from the latest poll so boundary crossings stay within 300ms', async () => {
    let mediaMs = 3_050;
    const {read} = await renderHarness(async () => mediaMs);

    await act(async () => {
      await Promise.resolve();
    });
    expect(read().activeIndex).toBe(0);

    await act(async () => {
      jest.advanceTimersByTime(200);
      await Promise.resolve();
    });
    expect(read().activeIndex).toBe(1);
  });

  it('returns -1 for empty segments', async () => {
    const {read} = await renderHarness(async () => 0, []);
    await act(async () => {
      jest.advanceTimersByTime(TRANSCRIPT_SYNC_POLL_INTERVAL_MS);
      await Promise.resolve();
    });
    expect(read().activeIndex).toBe(-1);
  });

  it('seekToIndex jumps to a segment and notifies onSeek', async () => {
    const onSeek = jest.fn();
    const {read} = await renderHarness(async () => 0, SAMPLE_SEGMENTS, onSeek);

    await act(async () => {
      read().seekToIndex(2);
    });

    expect(read().activeIndex).toBe(2);
    // SETE-325 (C-1): 300ms early-start compensation.
    expect(onSeek).toHaveBeenCalledWith(6_700);
  });

  it('compensates seek by 300ms (SETE-325, C-1)', () => {
    expect(TRANSCRIPT_SEEK_COMPENSATION_MS).toBe(300);
  });

  it('seekToIndex clamps the compensation at zero (SETE-325, C-1)', async () => {
    const onSeek = jest.fn();
    const segments = [makeSegment(0, 100, 3_000)];
    const {read} = await renderHarness(async () => 0, segments, onSeek);

    await act(async () => {
      read().seekToIndex(0);
    });

    expect(read().activeIndex).toBe(0);
    expect(onSeek).toHaveBeenCalledWith(0);
  });

  it('seekToIndex with exact skips the 300ms compensation (SETE-345)', async () => {
    const onSeek = jest.fn();
    const {read} = await renderHarness(async () => 0, SAMPLE_SEGMENTS, onSeek);

    await act(async () => {
      read().seekToIndex(2, {exact: true});
    });

    expect(read().activeIndex).toBe(2);
    expect(onSeek).toHaveBeenCalledWith(7_000);
  });

  it('holds the seek target while the player settles inside the previous sentence (SETE-345)', async () => {
    let mediaMs = 0;
    const {read} = await renderHarness(async () => mediaMs);

    await act(async () => {
      read().seekToIndex(2);
    });
    expect(read().activeIndex).toBe(2);

    // The compensated seek lands at 6_700ms; the player briefly reports
    // 6_600ms (sentence 1). The highlight must not flicker backwards.
    mediaMs = 6_600;
    await act(async () => {
      jest.advanceTimersByTime(TRANSCRIPT_SYNC_POLL_INTERVAL_MS);
      await Promise.resolve();
    });
    expect(read().activeIndex).toBe(2);

    // Once the settle window passes, polling follows the player again.
    await act(async () => {
      jest.advanceTimersByTime(TRANSCRIPT_SEEK_SETTLE_MS);
      await Promise.resolve();
    });
    expect(read().activeIndex).toBe(1);
  });

  it('observedIndex only follows player observations, never optimistic seeks (SETE-345)', async () => {
    let mediaMs = 0;
    const {read} = await renderHarness(async () => mediaMs);

    await act(async () => {
      read().seekToIndex(2);
    });
    expect(read().activeIndex).toBe(2);
    // The mount poll already confirmed sentence 0; the optimistic seek
    // must not move the observed index.
    expect(read().observedIndex).toBe(0);

    mediaMs = 7_100;
    await act(async () => {
      jest.advanceTimersByTime(TRANSCRIPT_SYNC_POLL_INTERVAL_MS);
      await Promise.resolve();
    });
    expect(read().activeIndex).toBe(2);
    expect(read().observedIndex).toBe(2);
  });

  it('seekToIndex ignores out-of-range indices', async () => {
    const onSeek = jest.fn();
    const {read} = await renderHarness(async () => 0, SAMPLE_SEGMENTS, onSeek);

    await act(async () => {
      read().seekToIndex(-1);
      read().seekToIndex(99);
    });

    expect(onSeek).not.toHaveBeenCalled();
  });

  it('recovers after early getCurrentTime calls never resolve (SETE-318)', async () => {
    // On a real device the sync hook starts polling before the iframe
    // player exists in the WebView. The injected time query then throws
    // inside the page, no reply is ever posted, and that poll's promise
    // pends forever — while the clip itself plays fine. The hook must
    // not let one hung call jam every later poll: the transcript has to
    // start following once the player answers.
    let hang = true;
    const mediaMs = 3_200;
    const getCurrentTimeMs = jest.fn(
      (): Promise<number> =>
        hang ? new Promise<number>(() => {}) : Promise.resolve(mediaMs),
    );
    const {read} = await renderHarness(getCurrentTimeMs);

    await act(async () => {
      jest.advanceTimersByTime(
        TRANSCRIPT_SYNC_POLL_INTERVAL_MS * 4 + TRANSCRIPT_SYNC_POLL_TIMEOUT_MS,
      );
      await Promise.resolve();
    });
    expect(read().activeIndex).toBe(-1);

    hang = false;
    await act(async () => {
      jest.advanceTimersByTime(TRANSCRIPT_SYNC_POLL_INTERVAL_MS);
      await Promise.resolve();
    });
    expect(read().activeIndex).toBe(1);
  });

  it('keeps polling while getCurrentTime keeps hanging (SETE-318)', async () => {
    // Every attempt hangs: the hook must keep retrying on later ticks
    // instead of wedging after the first hung call.
    const getCurrentTimeMs = jest.fn(
      (): Promise<number> => new Promise<number>(() => {}),
    );
    await renderHarness(getCurrentTimeMs);

    await act(async () => {
      jest.advanceTimersByTime(
        TRANSCRIPT_SYNC_POLL_TIMEOUT_MS * 2 + TRANSCRIPT_SYNC_POLL_INTERVAL_MS,
      );
      await Promise.resolve();
    });

    expect(getCurrentTimeMs.mock.calls.length).toBeGreaterThan(1);
  });

  it('supports seeking backward and forward across segments', async () => {
    let mediaMs = 8_000;
    const {read} = await renderHarness(async () => mediaMs);

    await act(async () => {
      jest.advanceTimersByTime(TRANSCRIPT_SYNC_POLL_INTERVAL_MS);
      await Promise.resolve();
    });
    expect(read().activeIndex).toBe(2);

    await act(async () => {
      read().seekToIndex(0);
    });
    expect(read().activeIndex).toBe(0);

    mediaMs = 500;
    await act(async () => {
      jest.advanceTimersByTime(TRANSCRIPT_SYNC_POLL_INTERVAL_MS);
      await Promise.resolve();
    });
    expect(read().activeIndex).toBe(0);

    await act(async () => {
      read().seekToIndex(1);
    });
    expect(read().activeIndex).toBe(1);
  });
});
