import {useEffect, useState} from 'react';

import type {LessonCatalogItem, LessonSnapshot} from '@core/schemas/lesson';

import {fetchVideoLessons} from './canonicalLessonClient';
import {isPublicVideo} from './useCanonicalCatalog';

/**
 * The six-step lessons listed under a public video, read online only: they
 * change without the video's content revision, so they are never stored with
 * its download. Empty for any other lesson, offline, or on a failed read.
 */
export function useVideoLessons(
  snapshot: LessonSnapshot | null,
  offline: boolean,
): LessonCatalogItem[] {
  const videoLessonId =
    snapshot !== null && isPublicVideo(snapshot) ? snapshot.id : null;
  const [lessons, setLessons] = useState<LessonCatalogItem[]>([]);

  useEffect(() => {
    setLessons([]);
    if (videoLessonId === null || offline) {
      return undefined;
    }
    let active = true;
    fetchVideoLessons(videoLessonId)
      .then(result => {
        if (active && result.ok) setLessons(result.value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [videoLessonId, offline]);

  return videoLessonId === null ? [] : lessons;
}
