import {youtubeThumbnailUrl} from '@ui/components/LibraryCover';

import type {LessonCatalogItem} from '@core/schemas/lesson';

import type {LessonCardLocalState} from './lessonCardData';

/**
 * The cover picture of a catalog lesson or video: the one the server sends
 * (the lesson's, else its unit's), else the video's YouTube thumbnail. Null
 * leaves the card on its default cover.
 */
export function catalogCoverUrl(
  item: Pick<LessonCatalogItem, 'cover_url' | 'youtube_video_id'>,
): string | null {
  if (item.cover_url) {
    return item.cover_url;
  }
  return item.youtube_video_id
    ? youtubeThumbnailUrl(item.youtube_video_id)
    : null;
}

/** The YouTube thumbnail of a downloaded video lesson, else null. */
export function downloadedVideoCoverUrl(
  localState: Pick<LessonCardLocalState, 'downloads'>,
  lessonId: string,
): string | null {
  const videoId = localState.downloads.get(lessonId)?.youtubeVideoId;
  return videoId ? youtubeThumbnailUrl(videoId) : null;
}
