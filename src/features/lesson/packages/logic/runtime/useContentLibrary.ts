import {
  getContentLessonById,
  getLessonAudioAssets,
  listActivePackageLessons,
} from '../data/ContentRuntimeRepository';
import type {
  ContentLessonListItem,
  ContentLessonRow,
} from '../data/ContentRuntimeRepository';

export type {ContentLessonListItem, ContentLessonRow};

/**
 * Public entry point for imported content-package reads. Screens call this
 * instead of importing content `data/ContentRuntimeRepository` directly
 * (SETE-118 Việc 3) — the repository stays synchronous under the hood, this
 * only relocates which layer is allowed to know about it.
 *
 * Each member forwards to the repository by name at call time (not captured
 * once into an object) so `jest.spyOn(ContentRuntimeRepository, ...)` in
 * existing tests keeps working through this indirection.
 */
export function useContentLibrary() {
  return contentLibrary;
}

const contentLibrary = {
  getContentLessonById: (...args: Parameters<typeof getContentLessonById>) =>
    getContentLessonById(...args),
  listActivePackageLessons: (
    ...args: Parameters<typeof listActivePackageLessons>
  ) => listActivePackageLessons(...args),
  getLessonAudioAssets: (...args: Parameters<typeof getLessonAudioAssets>) =>
    getLessonAudioAssets(...args),
};
