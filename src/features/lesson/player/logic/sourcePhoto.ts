import * as RNFS from '@dr.pogodin/react-native-fs';
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

/** Offline copies of source photos, one file per lesson. Photos never change, so a copy never goes stale. */
const CACHE_DIR_NAME = 'source-photos';

function cacheDir(): string {
  return `${RNFS.DocumentDirectoryPath}/${CACHE_DIR_NAME}`;
}

function cacheFile(lessonId: string): string {
  return `${cacheDir()}/${lessonId}.jpg`;
}

/** The copy saved on this device, if there is one. Works offline. */
export async function readCachedSourcePhoto(
  lessonId: string,
): Promise<SourcePhoto | null> {
  try {
    const file = cacheFile(lessonId);
    if (!(await RNFS.exists(file))) return null;
    return {uri: `file://${file}`, width: null, height: null};
  } catch {
    return null;
  }
}

/** Keeps a copy of the photo for offline study. Failure only means no offline copy. */
export async function cacheSourcePhoto(
  lessonId: string,
  remoteUri: string,
): Promise<void> {
  const file = cacheFile(lessonId);
  try {
    await RNFS.mkdir(cacheDir());
    const result = await RNFS.downloadFile({fromUrl: remoteUri, toFile: file})
      .promise;
    if (result.statusCode < 200 || result.statusCode >= 300) {
      await RNFS.unlink(file).catch(() => undefined);
    }
  } catch {
    // No offline copy this time; the next online open tries again.
  }
}

export async function removeCachedSourcePhoto(lessonId: string): Promise<void> {
  try {
    if (await RNFS.exists(cacheFile(lessonId))) {
      await RNFS.unlink(cacheFile(lessonId));
    }
  } catch {
    // A leftover file is removed with the rest of the cache.
  }
}

/** Used when local data is cleared: every offline source photo goes. */
export async function removeAllCachedSourcePhotos(): Promise<void> {
  try {
    if (await RNFS.exists(cacheDir())) {
      await RNFS.unlink(cacheDir());
    }
  } catch {
    // Best-effort, like the other local sweeps.
  }
}
