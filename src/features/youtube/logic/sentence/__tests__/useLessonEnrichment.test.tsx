import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {
  useLessonEnrichment,
  type UseLessonEnrichmentOptions,
} from '../useLessonEnrichment';
import {
  fetchLessonEnrichment,
  fetchSegmentEnrichment,
} from '../../api/sentenceEnrichmentApi';
import {
  makeEnrichment,
  makeSegment,
  VIDEO_ID,
} from './fixtures/sentenceFixtures';
import type {SentenceEnrichment} from '@shared/schemas/sentence-contract';

jest.mock('../../api/sentenceEnrichmentApi', () => ({
  fetchLessonEnrichment: jest.fn(),
  fetchSegmentEnrichment: jest.fn(),
}));

const mockFetchLesson = fetchLessonEnrichment as jest.Mock;
const mockFetchSegment = fetchSegmentEnrichment as jest.Mock;

function TestComponent({
  options,
  resultRef,
}: {
  options: UseLessonEnrichmentOptions;
  resultRef: {current: Record<number, SentenceEnrichment | null>};
}) {
  resultRef.current = useLessonEnrichment(options);
  return null;
}

function renderLessonEnrichmentHook(
  initialOptions: UseLessonEnrichmentOptions,
) {
  const resultRef: {current: Record<number, SentenceEnrichment | null>} = {
    current: {},
  };
  let tree: renderer.ReactTestRenderer;

  act(() => {
    tree = renderer.create(
      <TestComponent options={initialOptions} resultRef={resultRef} />,
    );
  });

  return {
    get result() {
      return resultRef.current;
    },
    rerender(newOptions: UseLessonEnrichmentOptions) {
      act(() => {
        tree.update(
          <TestComponent options={newOptions} resultRef={resultRef} />,
        );
      });
    },
    unmount() {
      act(() => {
        tree.unmount();
      });
    },
  };
}

describe('useLessonEnrichment', () => {
  const segments = [
    makeSegment({index: 0}),
    makeSegment({index: 1}),
    makeSegment({index: 2}),
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('AC-002: uses non-empty injected enrichmentMap without calling batch or segment fetch', () => {
    const injectedMap = {0: makeEnrichment()};

    const hook = renderLessonEnrichmentHook({
      videoId: VIDEO_ID,
      segments,
      enrichmentMap: injectedMap,
    });

    expect(hook.result).toEqual(injectedMap);
    expect(mockFetchLesson).not.toHaveBeenCalled();
    expect(mockFetchSegment).not.toHaveBeenCalled();
  });

  it('AC-003: calls whole-lesson batch enrichment first and merges results without fallback', async () => {
    const batchEnrichments = {
      0: makeEnrichment({keyWord: 'batch0'}),
      1: makeEnrichment({keyWord: 'batch1'}),
    };

    let resolveBatch!: (value: any) => void;
    const batchPromise = new Promise(resolve => {
      resolveBatch = resolve;
    });

    mockFetchLesson.mockReturnValue(batchPromise);

    const hook = renderLessonEnrichmentHook({
      videoId: VIDEO_ID,
      segments,
      enrichmentMap: {},
    });

    expect(mockFetchLesson).toHaveBeenCalledTimes(1);
    expect(mockFetchLesson).toHaveBeenCalledWith({
      videoId: VIDEO_ID,
      signal: expect.any(AbortSignal),
    });

    await act(async () => {
      resolveBatch({ok: true, enrichments: batchEnrichments});
    });

    expect(hook.result).toEqual(batchEnrichments);
    expect(mockFetchSegment).not.toHaveBeenCalled();
  });

  it('AC-004: falls back to sequential segment fetch when batch fails, continuing past errors', async () => {
    mockFetchLesson.mockResolvedValueOnce({ok: false, status: 500});

    const seg0Enrichment = makeEnrichment({keyWord: 'seg0'});
    const seg2Enrichment = makeEnrichment({keyWord: 'seg2'});

    let resolveSeg0!: (val: any) => void;
    let resolveSeg1!: (val: any) => void;
    let resolveSeg2!: (val: any) => void;

    mockFetchSegment
      .mockImplementationOnce(
        () =>
          new Promise(r => {
            resolveSeg0 = r;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise(r => {
            resolveSeg1 = r;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise(r => {
            resolveSeg2 = r;
          }),
      );

    const hook = renderLessonEnrichmentHook({
      videoId: VIDEO_ID,
      segments,
    });

    await act(async () => {
      // batch resolves to false
    });

    expect(mockFetchSegment).toHaveBeenCalledTimes(1);
    expect(mockFetchSegment).toHaveBeenNthCalledWith(1, {
      videoId: VIDEO_ID,
      segmentIndex: 0,
      signal: expect.any(AbortSignal),
    });

    await act(async () => {
      resolveSeg0({ok: true, enrichment: seg0Enrichment});
    });

    expect(hook.result[0]).toEqual(seg0Enrichment);
    expect(mockFetchSegment).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveSeg1({ok: false, status: 500});
    });

    expect(hook.result[1]).toBeUndefined();
    expect(mockFetchSegment).toHaveBeenCalledTimes(3);

    await act(async () => {
      resolveSeg2({ok: true, enrichment: seg2Enrichment});
    });

    expect(hook.result[0]).toEqual(seg0Enrichment);
    expect(hook.result[1]).toBeUndefined();
    expect(hook.result[2]).toEqual(seg2Enrichment);
  });

  it('AC-005: handles successful whole-lesson response with empty enrichment object without falling back', async () => {
    mockFetchLesson.mockResolvedValueOnce({ok: true, enrichments: {}});

    const hook = renderLessonEnrichmentHook({
      videoId: VIDEO_ID,
      segments,
    });

    await act(async () => {});

    expect(hook.result).toEqual({});
    expect(mockFetchSegment).not.toHaveBeenCalled();
  });

  it('AC-006: aborts in-flight request and prevents stale updates on unmount or new injected map', async () => {
    let capturedSignal!: AbortSignal;
    let resolveBatch!: (val: any) => void;

    mockFetchLesson.mockImplementationOnce(({signal}) => {
      capturedSignal = signal;
      return new Promise(r => {
        resolveBatch = r;
      });
    });

    const hook = renderLessonEnrichmentHook({
      videoId: VIDEO_ID,
      segments,
    });

    expect(capturedSignal.aborted).toBe(false);

    const newInjectedMap = {0: makeEnrichment({keyWord: 'newInjected'})};

    hook.rerender({
      videoId: VIDEO_ID,
      segments,
      enrichmentMap: newInjectedMap,
    });

    expect(capturedSignal.aborted).toBe(true);
    expect(hook.result).toEqual(newInjectedMap);

    await act(async () => {
      resolveBatch({
        ok: true,
        enrichments: {0: makeEnrichment({keyWord: 'stale'})},
      });
    });

    expect(hook.result).toEqual(newInjectedMap);

    // Test unmount cleanup
    let resolveBatch2!: (val: any) => void;
    let capturedSignal2!: AbortSignal;
    mockFetchLesson.mockImplementationOnce(({signal}) => {
      capturedSignal2 = signal;
      return new Promise(r => {
        resolveBatch2 = r;
      });
    });

    const hook2 = renderLessonEnrichmentHook({
      videoId: VIDEO_ID,
      segments,
    });

    expect(capturedSignal2.aborted).toBe(false);
    hook2.unmount();
    expect(capturedSignal2.aborted).toBe(true);

    await act(async () => {
      resolveBatch2({
        ok: true,
        enrichments: {0: makeEnrichment({keyWord: 'stale2'})},
      });
    });
  });
});
