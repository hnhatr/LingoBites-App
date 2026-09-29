import {useEffect, useState} from 'react';
import type {SentenceEnrichment} from '@core/schemas/sentence-contract';
import {
  fetchLessonEnrichment,
  fetchSegmentEnrichment,
} from '../api/sentenceEnrichmentApi';

export type UseLessonEnrichmentOptions = {
  videoId?: string;
  segments?: readonly {index: number}[];
  enrichmentMap?: Record<number, SentenceEnrichment | null>;
};

/** Runs an async side effect without returning its promise to the caller. */
function fireAndForget(task: Promise<unknown>): void {
  task.catch(() => undefined);
}

export function useLessonEnrichment({
  videoId,
  segments,
  enrichmentMap,
}: UseLessonEnrichmentOptions): Record<number, SentenceEnrichment | null> {
  const [internalEnrichmentMap, setInternalEnrichmentMap] = useState<
    Record<number, SentenceEnrichment | null>
  >(enrichmentMap ?? {});

  useEffect(() => {
    if (enrichmentMap) {
      setInternalEnrichmentMap(enrichmentMap);
    }
  }, [enrichmentMap]);

  useEffect(() => {
    if (enrichmentMap && Object.keys(enrichmentMap).length > 0) {
      return undefined;
    }
    if (!videoId || !segments) {
      return undefined;
    }
    let cancelled = false;
    const controller = new AbortController();

    async function loadEnrichments() {
      // 1. Try batch lesson enrichment endpoint first
      const batchResult = await fetchLessonEnrichment({
        videoId: videoId!,
        signal: controller.signal,
      });
      if (cancelled) {
        return;
      }
      if (batchResult.ok && batchResult.enrichments) {
        setInternalEnrichmentMap(prev => ({
          ...prev,
          ...batchResult.enrichments,
        }));
        return;
      }

      // 2. Fallback to per-segment enrichment fetch
      for (const segment of segments!) {
        if (cancelled) {
          return;
        }
        const segResult = await fetchSegmentEnrichment({
          videoId: videoId!,
          segmentIndex: segment.index,
          signal: controller.signal,
        });
        if (cancelled) {
          return;
        }
        if (segResult.ok && segResult.enrichment) {
          setInternalEnrichmentMap(prev => ({
            ...prev,
            [segment.index]: segResult.enrichment,
          }));
        }
      }
    }

    fireAndForget(loadEnrichments());

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enrichmentMap, segments, videoId]);

  return internalEnrichmentMap;
}
