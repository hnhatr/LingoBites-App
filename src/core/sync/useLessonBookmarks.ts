import {useCallback, useEffect, useState} from 'react';

import {
  isLessonBookmarked,
  type LessonBookmark,
  listLessonBookmarks,
  removeLessonBookmark,
  saveLessonBookmark,
  type SaveLessonBookmarkInput,
  subscribeLessonBookmarks,
} from './lessonBookmarks';

function readBookmarks(): LessonBookmark[] {
  try {
    return listLessonBookmarks();
  } catch {
    return [];
  }
}

/** Saved lessons, newest first, kept current across saves and sync pulls. */
export function useSavedLessons(): LessonBookmark[] {
  const [bookmarks, setBookmarks] = useState<LessonBookmark[]>(readBookmarks);
  useEffect(
    () => subscribeLessonBookmarks(() => setBookmarks(readBookmarks())),
    [],
  );
  return bookmarks;
}

export type UseLessonBookmarksResult = {
  isBookmarked: (lessonId: string) => boolean;
  /** Saves the lesson, or unsaves it when it is already saved. */
  toggleBookmark: (card: Omit<SaveLessonBookmarkInput, 'now'>) => void;
};

/** Bookmark state for a list of lesson cards. */
export function useLessonBookmarks(): UseLessonBookmarksResult {
  const bookmarks = useSavedLessons();
  const ids = new Set(bookmarks.map(bookmark => bookmark.lessonId));

  const toggleBookmark = useCallback(
    (card: Omit<SaveLessonBookmarkInput, 'now'>) => {
      try {
        if (isLessonBookmarked(card.lessonId)) {
          removeLessonBookmark(card.lessonId);
        } else {
          saveLessonBookmark(card);
        }
      } catch {
        // Database not ready: leave the card as it is.
      }
    },
    [],
  );

  return {
    isBookmarked: (lessonId: string) => ids.has(lessonId),
    toggleBookmark,
  };
}
