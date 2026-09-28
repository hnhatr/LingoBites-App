/**
 * Side-effect-free YouTube lesson/library public port (LING-104 / TASK-015).
 * Cross-feature callers must use this entry (or the root barrel re-exports)
 * — not private `data/*` paths.
 */
export {
  countYouTubeLessons,
  countYoutubeLessons,
  deleteYouTubeLesson,
  deleteYoutubeLesson,
  getYouTubeLesson,
  getYoutubeLesson,
  listYouTubeLessons,
  listYoutubeLessons,
  saveYouTubeLesson,
  saveYoutubeLesson,
} from './data/YouTubeLessonRepository';
export type {
  SaveYouTubeLessonInput,
  SaveYouTubeLessonResult,
} from './data/YouTubeLessonRepository';
export {
  clearYouTubeProgress,
  getYouTubeProgress,
  saveYouTubeProgress,
} from './data/YouTubeProgressRepository';
export type {YouTubeProgress} from './data/YouTubeProgressRepository';
