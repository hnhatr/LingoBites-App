import AsyncStorage from '@react-native-async-storage/async-storage';
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

const CACHE_KEY = 'moment-library:v1';

/** The last list this device got, shown when the network is not there. */
export async function readCachedMomentLibrary(): Promise<
  MomentLibraryItem[] | null
> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = z.array(MomentLibraryItemSchema).safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    return parsed.data.map(toItem);
  } catch {
    return null;
  }
}

async function saveCachedMomentLibrary(
  items: MomentLibraryItem[],
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify(
        items.map(item => ({
          lesson_id: item.lessonId,
          title: item.title,
          moment_intent: item.intent,
          situation_title_vi: item.situationTitleVi,
          created_at: item.createdAt,
          thumbnail_url: item.thumbnailUri,
        })),
      ),
    );
  } catch {
    // Without the cache the list still works online.
  }
}

function toItem(
  row: z.infer<typeof MomentLibraryItemSchema>,
): MomentLibraryItem {
  return {
    lessonId: row.lesson_id,
    title: row.title,
    intent: row.moment_intent,
    situationTitleVi: row.situation_title_vi,
    createdAt: row.created_at,
    thumbnailUri: row.thumbnail_url,
  };
}

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
  const items = parsed.data.moments.map(row =>
    toItem({
      ...row,
      thumbnail_url: row.thumbnail_url
        ? `${apiBaseUrl}${row.thumbnail_url}`
        : null,
    }),
  );
  await saveCachedMomentLibrary(items);
  return {ok: true, value: items};
}
