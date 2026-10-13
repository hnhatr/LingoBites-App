import {youtubeThumbnailUrl} from '@ui/components/LibraryCover';

import type {LessonCatalogItem} from '@core/schemas/lesson';

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
