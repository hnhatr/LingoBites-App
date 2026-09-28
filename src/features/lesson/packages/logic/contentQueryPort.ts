/**
 * Side-effect-free content data/query public port (LING-102 / TASK-013).
 * Cross-feature callers that need content SQLite reads/writes must use this
 * entry (or the root barrel re-exports below) — not private `data/*` paths.
 */
export {
  getActivePackage,
  getPackageById,
  insertPackageRecord,
  listPackages,
  swapActivePackage,
} from './data/ContentPackageRepository';
export type {ContentPackageId, ContentPackageSummary} from './importer';
export {
  getContentLessonState,
  listSavedLessons,
  listStartedLessons,
  saveContentLesson,
  startContentLesson,
  unsaveContentLesson,
  unstartContentLesson,
} from './data/ContentLessonStateRepository';
export type {
  ContentLessonState,
  SaveContentLessonInput,
  SaveContentLessonResult,
} from '@shared/db/types';
export {
  getContentLessonById,
  getDueContentReviewItems,
  getLessonActivities,
  getLessonAudioAssets,
  getLessonChunks,
  listActivePackageLessons,
  listContentReviewItems,
} from './data/ContentRuntimeRepository';
export type {
  ContentActivityRow,
  ContentChunkRow,
  ContentLessonListItem,
  ContentLessonRow,
} from './data/ContentRuntimeRepository';
