import {z} from 'zod';

import {getAppConfig} from '@core/api/appConfig';

import {
  type CanonicalLessonClientOptions,
  type CanonicalLessonResult,
  contentError,
  errorFromStatus,
  send,
} from './canonicalLessonClient';

/** E4: the photo a lesson was made from, as a link the App can show (and the offline download can fetch). */
const SourcePhotoSchema = z.object({
  url: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
});
export type SourcePhoto = {
  uri: string;
  width: number | null;
  height: number | null;
};

export async function fetchSourcePhoto(
  lessonId: string,
  options: CanonicalLessonClientOptions = {},
): Promise<CanonicalLessonResult<SourcePhoto | null>> {
  const answered = await send(
    `/api/v1/lessons/${encodeURIComponent(lessonId)}/source-image`,
    {method: 'GET'},
    'IMAGE_NOT_FOUND',
    options,
  );
  if (!('body' in answered)) return answered;
  if (answered.status === 404) return {ok: true, value: null};
  if (answered.status < 200 || answered.status >= 300) {
    return errorFromStatus(answered.status, answered.body, 'IMAGE_NOT_FOUND');
  }
  const parsed = SourcePhotoSchema.safeParse(answered.body);
  if (!parsed.success) return contentError('Source photo failed validation.');
  const {apiBaseUrl} = getAppConfig();
  return {
    ok: true,
    value: {
      uri: `${apiBaseUrl}${parsed.data.url}`,
      width: parsed.data.width,
      height: parsed.data.height,
    },
  };
}
