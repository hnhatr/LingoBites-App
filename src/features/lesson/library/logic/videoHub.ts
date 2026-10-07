import {listDownloadedLessonSummaries} from '@features/lesson/player';

import {listInProgressLessonIds} from '@core/sync/lessonProgress';

export type VideoInProgress = {
  lessonId: string;
  title: string;
  sentenceCount: number;
  youtubeDurationMs: number | null;
};

/**
 * The most recently studied YouTube lesson that is not finished, own or
 * public. Null when there is none, or when local data cannot be read yet.
 */
export function findVideoInProgress(): VideoInProgress | null {
  try {
    const videos = listDownloadedLessonSummaries().filter(
      summary => summary.snapshot.source_type === 'youtube',
    );
    if (videos.length === 0) return null;
    for (const lessonId of listInProgressLessonIds()) {
      const match = videos.find(summary => summary.lessonId === lessonId);
      if (match) {
        return {
          lessonId: match.lessonId,
          title: match.title,
          sentenceCount: match.snapshot.sentences.length,
          youtubeDurationMs: match.snapshot.youtube?.duration_ms ?? null,
        };
      }
    }
  } catch {
    // Database not ready: no "continue" card.
  }
  return null;
}
