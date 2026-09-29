/**
 * Paginated unified-lesson catalog hook over `fetchLessonCatalogPage`.
 *
 * Loads the first page on mount (when `enabled`), appends further pages
 * via `loadMore`, and resets via `refresh`. Cancellation-safe: late
 * responses after unmount, refresh, or a newer page request are
 * discarded by request generation. Mixed origins stay one flat list —
 * no grouping, no source sections.
 */
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  fetchLessonCatalogPage,
  type LessonCatalogError,
  type UnifiedLessonSummary,
} from './lessonCatalogClient';

export type LessonCatalogState =
  | {status: 'loading'; items: UnifiedLessonSummary[]}
  | {status: 'ready'; items: UnifiedLessonSummary[]; hasMore: boolean}
  | {status: 'refreshing'; items: UnifiedLessonSummary[]}
  | {status: 'loading-more'; items: UnifiedLessonSummary[]; hasMore: boolean}
  | {status: 'error'; items: UnifiedLessonSummary[]; error: LessonCatalogError};

export type UseLessonCatalogOptions = {
  enabled?: boolean;
  fetchImpl?: typeof fetch;
};

export type UseLessonCatalogResult = LessonCatalogState & {
  refresh: () => void;
  loadMore: () => void;
};

export function useLessonCatalog(
  options: UseLessonCatalogOptions = {},
): UseLessonCatalogResult {
  const {enabled = true, fetchImpl} = options;
  const [state, setState] = useState<LessonCatalogState>({
    status: 'loading',
    items: [],
  });
  const generationRef = useRef(0);
  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);
  const statusRef = useRef(state.status);
  statusRef.current = state.status;

  const loadPage = useCallback(
    async (cursor: string | null, generation: number, append: boolean) => {
      const result = await fetchLessonCatalogPage({
        cursor: cursor ?? undefined,
        fetchImpl,
      });
      if (generationRef.current !== generation) return;
      if (!result.ok) {
        setState(prev => ({status: 'error', items: prev.items, error: result}));
        return;
      }
      cursorRef.current = result.nextCursor;
      hasMoreRef.current = result.nextCursor !== null;
      setState(prev => ({
        status: 'ready',
        items: append ? [...prev.items, ...result.lessons] : result.lessons,
        hasMore: result.nextCursor !== null,
      }));
    },
    [fetchImpl],
  );

  const start = useCallback(
    (mode: 'initial' | 'refresh' | 'more') => {
      const generation = generationRef.current + 1;
      generationRef.current = generation;
      if (mode === 'more') {
        if (!hasMoreRef.current) return;
        setState(prev => ({
          status: 'loading-more',
          items: prev.items,
          hasMore: true,
        }));
        void loadPage(cursorRef.current, generation, true);
        return;
      }
      cursorRef.current = null;
      hasMoreRef.current = true;
      setState(prev => ({
        status: mode === 'refresh' ? 'refreshing' : 'loading',
        items: mode === 'refresh' ? prev.items : [],
      }));
      void loadPage(null, generation, false);
    },
    [loadPage],
  );

  const refresh = useCallback(() => start('refresh'), [start]);
  const loadMore = useCallback(() => {
    if (statusRef.current === 'ready' && hasMoreRef.current) {
      start('more');
    }
  }, [start]);

  useEffect(() => {
    if (!enabled) return;
    start('initial');
    return () => {
      generationRef.current += 1;
    };
  }, [enabled, start]);

  // Memoized so focus/refresh effects depending on the result do not
  // re-fire on every render — only on real state transitions.
  return useMemo(
    () => ({...state, refresh, loadMore} as UseLessonCatalogResult),
    [state, refresh, loadMore],
  );
}
