import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {SentenceEnrichment} from '@shared/schemas/sentence-contract';
import {retrySentenceBlock} from '../api/sentenceEnrichmentApi';
import {
  deriveBlockStates,
  type SentenceBlockErrors,
  type SentenceBlockId,
  type SentenceBlockStates,
} from './sentencePipeline';

export type RetryBlockFn = typeof retrySentenceBlock;

export type UseSentenceEnrichmentOptions = {
  videoId: string;
  segmentIndex: number;
  /**
   * Enrichment known so far (`null` while the sentence has none). The parent
   * may pass progressively fuller payloads as AI blocks arrive — each new
   * value replaces the current one.
   */
  initialEnrichment: SentenceEnrichment | null;
  /** Injectable for tests; defaults to the real per-block retry API. */
  retryBlock?: RetryBlockFn;
};

export type UseSentenceEnrichmentResult = {
  enrichment: SentenceEnrichment | null;
  states: SentenceBlockStates;
  errors: SentenceBlockErrors;
  retrying: Record<SentenceBlockId, boolean>;
  retry: (block: SentenceBlockId) => Promise<void>;
};

const IDLE_RETRYING: Record<SentenceBlockId, boolean> = {
  keyword: false,
  vocab: false,
  grammar: false,
};

/**
 * SETE-329 (TASK-2): owns one sentence card's async AI blocks. Retrying a
 * single block re-fetches only that block; other blocks keep their state.
 */
export function useSentenceEnrichment(
  options: UseSentenceEnrichmentOptions,
): UseSentenceEnrichmentResult {
  const {
    videoId,
    segmentIndex,
    initialEnrichment,
    retryBlock = retrySentenceBlock,
  } = options;
  const [enrichment, setEnrichment] = useState<SentenceEnrichment | null>(
    initialEnrichment,
  );
  const [errors, setErrors] = useState<SentenceBlockErrors>({});
  const [retrying, setRetrying] =
    useState<Record<SentenceBlockId, boolean>>(IDLE_RETRYING);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setEnrichment(initialEnrichment);
  }, [initialEnrichment]);

  const retry = useCallback(
    async (block: SentenceBlockId): Promise<void> => {
      setRetrying(current => ({...current, [block]: true}));
      // Clear the old error so the block shows its skeleton while refetching.
      setErrors(current => {
        if (current[block] == null) {
          return current;
        }
        const next = {...current};
        delete next[block];
        return next;
      });
      let result: Awaited<ReturnType<RetryBlockFn>>;
      try {
        result = await retryBlock({videoId, segmentIndex, block});
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }
        setErrors(current => ({
          ...current,
          [block]: error instanceof Error ? error.message : 'RETRY_FAILED',
        }));
        setRetrying(current => ({...current, [block]: false}));
        return;
      }
      if (!mountedRef.current) {
        return;
      }
      if (result.ok) {
        setEnrichment(result.enrichment);
      } else if (result.message !== 'cancelled') {
        setErrors(current => ({...current, [block]: result.message}));
      }
      setRetrying(current => ({...current, [block]: false}));
    },
    [retryBlock, segmentIndex, videoId],
  );

  const states = useMemo(
    () => deriveBlockStates(enrichment, errors),
    [enrichment, errors],
  );

  return {enrichment, states, errors, retrying, retry};
}
