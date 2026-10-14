import {useEffect, useState} from 'react';
import {z} from 'zod';

import {
  type CanonicalLessonClientOptions,
  type CanonicalLessonResult,
  contentError,
  errorFromStatus,
  send,
} from './canonicalLessonClient';

/**
 * The cover and item pictures of a catalog lesson, served beside its
 * snapshot (`GET /api/v1/lessons/:id/pictures`). Pictures are decoration:
 * any failure (offline, older server, broken link) leaves the defaults.
 */
const LessonPicturesSchema = z.object({
  cover_url: z.string().nullable(),
  item_images: z.array(z.object({item_id: z.string(), url: z.string()})),
});

export type LessonPictures = {
  coverUrl: string | null;
  /** Item id → picture URL. */
  itemImages: ReadonlyMap<string, string>;
};

export const NO_LESSON_PICTURES: LessonPictures = {
  coverUrl: null,
  itemImages: new Map(),
};

export async function fetchLessonPictures(
  lessonId: string,
  options: CanonicalLessonClientOptions = {},
): Promise<CanonicalLessonResult<LessonPictures>> {
  const answered = await send(
    `/api/v1/lessons/${encodeURIComponent(lessonId)}/pictures`,
    {method: 'GET'},
    'LESSON_NOT_FOUND',
    options,
  );
  if (!('body' in answered)) return answered;
  if (answered.status < 200 || answered.status >= 300) {
    return errorFromStatus(answered.status, answered.body, 'LESSON_NOT_FOUND');
  }
  const parsed = LessonPicturesSchema.safeParse(answered.body);
  if (!parsed.success)
    return contentError('Lesson pictures failed validation.');
  return {
    ok: true,
    value: {
      coverUrl: parsed.data.cover_url,
      itemImages: new Map(
        parsed.data.item_images.map(image => [image.item_id, image.url]),
      ),
    },
  };
}

/** Kept for the session, so going back and forth does not refetch. */
const memory = new Map<string, LessonPictures>();

/**
 * Pictures of one lesson; the defaults until (and unless) they load. Asks the
 * server only when `enabled` (a catalog lesson) and online.
 */
export function useLessonPictures(
  lessonId: string,
  enabled: boolean,
  offline: boolean,
): LessonPictures {
  const [pictures, setPictures] = useState<LessonPictures>(
    () => memory.get(lessonId) ?? NO_LESSON_PICTURES,
  );

  useEffect(() => {
    const known = memory.get(lessonId);
    if (known) {
      setPictures(known);
      return;
    }
    setPictures(NO_LESSON_PICTURES);
    if (!enabled || offline) return;
    const controller = new AbortController();
    fetchLessonPictures(lessonId, {signal: controller.signal}).then(result => {
      if (controller.signal.aborted || !result.ok) return;
      memory.set(lessonId, result.value);
      setPictures(result.value);
    });
    return () => controller.abort();
  }, [lessonId, enabled, offline]);

  return pictures;
}
