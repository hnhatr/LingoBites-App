import {useCallback, useState} from 'react';

import type {LessonCatalogItem} from '@core/schemas/lesson';

import {
  type CanonicalLessonError,
  fetchLessonCatalog,
} from './canonicalLessonClient';

export type CanonicalCatalogState =
  | {status: 'idle'}
  | {status: 'loading'}
  | {
      status: 'ready';
      lessons: LessonCatalogItem[];
      nextCursor: string | null;
      loadingMore: boolean;
    }
  | {status: 'error'; error: CanonicalLessonError};

/**
 * Canonical catalog hook: paged `GET /api/v1/lessons` through the strict
 * contract mirror. Every source (admin/learner text, OCR, YouTube) appears
 * in the same catalog and opens the same player.
 */
export function useCanonicalCatalog() {
  const [state, setState] = useState<CanonicalCatalogState>({status: 'idle'});

  const refresh = useCallback(async () => {
    setState({status: 'loading'});
    const result = await fetchLessonCatalog({limit: 20});
    if (!result.ok) {
      setState({status: 'error', error: result});
      return;
    }
    setState({
      status: 'ready',
      lessons: result.value.lessons,
      nextCursor: result.value.next_cursor,
      loadingMore: false,
    });
  }, []);

  const loadMore = useCallback(async () => {
    let cursor: string | null = null;
    let current: LessonCatalogItem[] = [];
    setState(previous => {
      if (previous.status === 'ready') {
        cursor = previous.nextCursor;
        current = previous.lessons;
        return {...previous, loadingMore: true};
      }
      return previous;
    });
    if (!cursor) {
      setState(previous =>
        previous.status === 'ready'
          ? {...previous, loadingMore: false}
          : previous,
      );
      return;
    }
    const result = await fetchLessonCatalog({limit: 20, cursor});
    if (!result.ok) {
      setState(previous =>
        previous.status === 'ready'
          ? {...previous, loadingMore: false}
          : {status: 'error', error: result},
      );
      return;
    }
    setState({
      status: 'ready',
      lessons: [...current, ...result.value.lessons],
      nextCursor: result.value.next_cursor,
      loadingMore: false,
    });
  }, []);

  return {state, refresh, loadMore};
}
