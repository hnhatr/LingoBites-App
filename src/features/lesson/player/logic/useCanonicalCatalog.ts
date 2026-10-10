import {useCallback, useState} from 'react';

import type {
  LessonCatalogItem,
  LessonCatalogKind,
  LessonOrigin,
  LessonSourceType,
} from '@core/schemas/lesson';

import {
  type LessonDownloadRecord,
  listLessonDownloads,
} from './canonicalDownloadRepository';
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
      /** Offline (#9): only lessons downloaded on this device. */
      offline?: boolean;
    }
  | {status: 'error'; error: CanonicalLessonError};

/**
 * Canonical catalog hook: paged `GET /api/v1/lessons` through the strict
 * contract mirror. Every source (admin/learner text, OCR, YouTube) appears
 * in the same catalog and opens the same player.
 */
export type CanonicalCatalogFilter = {
  origin?: LessonOrigin;
  sourceType?: LessonSourceType;
  kind?: LessonCatalogKind;
};

/** A public video: an admin YouTube lesson outside any unit. */
export function isPublicVideo(item: {
  origin: LessonOrigin;
  source_type: LessonSourceType;
  unit: unknown;
}): boolean {
  return (
    item.origin === 'admin' &&
    item.source_type === 'youtube' &&
    item.unit === null
  );
}

function toCatalogItem({snapshot}: LessonDownloadRecord): LessonCatalogItem {
  return {
    id: snapshot.id,
    title: snapshot.title,
    description: snapshot.description,
    origin: snapshot.origin,
    source_type: snapshot.source_type,
    content_revision: snapshot.content_revision,
    sentence_count: snapshot.sentences.length,
    youtube_video_id: snapshot.youtube?.video_id ?? null,
    unit: snapshot.unit,
    updated_at: '',
    youtube_duration_ms: snapshot.youtube?.duration_ms ?? null,
  };
}

/**
 * Offline mode (#9): the catalog falls back to the lessons downloaded on
 * this device, which the player opens without the network.
 */
export function downloadedCatalogItems(
  filter: CanonicalCatalogFilter = {},
): LessonCatalogItem[] {
  try {
    return listLessonDownloads()
      .map(toCatalogItem)
      .filter(
        item =>
          (!filter.origin || item.origin === filter.origin) &&
          (!filter.sourceType || item.source_type === filter.sourceType) &&
          (!filter.kind || isPublicVideo(item) === (filter.kind === 'video')),
      );
  } catch {
    return [];
  }
}

export function useCanonicalCatalog(filter: CanonicalCatalogFilter = {}) {
  const {origin, sourceType, kind} = filter;
  const [state, setState] = useState<CanonicalCatalogState>({status: 'idle'});

  const refresh = useCallback(async () => {
    setState({status: 'loading'});
    const result = await fetchLessonCatalog({
      limit: 20,
      origin,
      sourceType,
      kind,
    });
    if (!result.ok) {
      const downloaded =
        result.kind === 'network-error'
          ? downloadedCatalogItems({origin, sourceType, kind})
          : [];
      setState(
        downloaded.length > 0
          ? {
              status: 'ready',
              lessons: downloaded,
              nextCursor: null,
              loadingMore: false,
              offline: true,
            }
          : {status: 'error', error: result},
      );
      return;
    }
    setState({
      status: 'ready',
      lessons: result.value.lessons,
      nextCursor: result.value.next_cursor,
      loadingMore: false,
    });
  }, [origin, sourceType, kind]);

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
    const result = await fetchLessonCatalog({
      limit: 20,
      cursor,
      origin,
      sourceType,
      kind,
    });
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
  }, [origin, sourceType, kind]);

  return {state, refresh, loadMore};
}
