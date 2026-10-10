import {z} from 'zod';

import {
  type CanonicalLessonClientOptions,
  type CanonicalLessonResult,
  contentError,
  errorFromStatus,
  send,
} from '@features/lesson/player';

import {getAppConfig} from '@core/api/appConfig';

/** E5 (S1, S2): one card of the "Khoảnh khắc" list. */
const MomentLibraryItemSchema = z.object({
  lesson_id: z.string().uuid(),
  title: z.string(),
  moment_intent: z.enum(['understand', 'use', 'describe']).nullable(),
  situation_title_vi: z.string().nullable(),
  created_at: z.string(),
  thumbnail_url: z.string().nullable(),
});

const MomentLibraryResponseSchema = z.object({
  moments: z.array(MomentLibraryItemSchema),
});

export type MomentLibraryItem = {
  lessonId: string;
  title: string;
  intent: 'understand' | 'use' | 'describe' | null;
  situationTitleVi: string | null;
  createdAt: string;
  /** Absolute link to the photo thumbnail, when the moment had a photo. */
  thumbnailUri: string | null;
};

/** The learner's moment lessons, newest first. Needs the network. */
export async function fetchMomentLibrary(
  options: CanonicalLessonClientOptions = {},
): Promise<CanonicalLessonResult<MomentLibraryItem[]>> {
  const answered = await send(
    '/api/v1/moments/library',
    {method: 'GET'},
    'STORE_UNAVAILABLE',
    options,
  );
  if (!('body' in answered)) return answered;
  if (answered.status < 200 || answered.status >= 300) {
    return errorFromStatus(answered.status, answered.body, 'STORE_UNAVAILABLE');
  }
  const parsed = MomentLibraryResponseSchema.safeParse(answered.body);
  if (!parsed.success) return contentError('Moment list failed validation.');
  const {apiBaseUrl} = getAppConfig();
  return {
    ok: true,
    value: parsed.data.moments.map(row => ({
      lessonId: row.lesson_id,
      title: row.title,
      intent: row.moment_intent,
      situationTitleVi: row.situation_title_vi,
      createdAt: row.created_at,
      thumbnailUri: row.thumbnail_url
        ? `${apiBaseUrl}${row.thumbnail_url}`
        : null,
    })),
  };
}
