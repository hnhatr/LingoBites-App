import {useFocusEffect} from '@react-navigation/native';
import {useCallback, useState} from 'react';

import {
  lessonMediaSizeBytes,
  listLessonMediaDownloads,
  type MediaDownloadConsent,
  readMediaDownloadConsent,
  removeAllLessonMedia,
  removeLessonMedia,
  setMediaDownloadConsent,
  sweepLessonMedia,
} from '@features/lesson/player';

export type OfflineMediaEntry = {
  lessonId: string;
  title: string;
  bytes: number;
};

export const MEDIA_CONSENT_LABELS: Record<MediaDownloadConsent, string> = {
  auto: 'Tự động',
  manual: 'Tự chọn bài',
  undecided: 'Chưa chọn',
};

async function sweepQuietly(): Promise<void> {
  try {
    await sweepLessonMedia();
  } catch {
    // Best-effort; the rows no longer point at the files.
  }
}

/**
 * "Học offline" settings: the media download choice and the lessons whose
 * images and audio are stored on the device, with their size. Reloads each
 * time the screen regains focus (a lesson may have downloaded media since).
 */
export function useOfflineStudySettings() {
  const [consent, setConsent] = useState<MediaDownloadConsent>(
    readMediaDownloadConsent,
  );
  const [entries, setEntries] = useState<OfflineMediaEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    setConsent(readMediaDownloadConsent());
    const downloads = listLessonMediaDownloads();
    const sized = await Promise.all(
      downloads.map(async download => ({
        lessonId: download.lessonId,
        title: download.title,
        bytes: await lessonMediaSizeBytes(download.mediaDir),
      })),
    );
    setEntries(sized);
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const chooseConsent = useCallback((value: 'auto' | 'manual') => {
    setMediaDownloadConsent(value);
    setConsent(value);
  }, []);

  const removeOne = useCallback(
    async (lessonId: string) => {
      removeLessonMedia(lessonId);
      await sweepQuietly();
      await reload();
    },
    [reload],
  );

  const removeAll = useCallback(async () => {
    removeAllLessonMedia();
    await sweepQuietly();
    await reload();
  }, [reload]);

  const totalBytes = entries.reduce((total, entry) => total + entry.bytes, 0);

  return {
    consent,
    chooseConsent,
    entries,
    loaded,
    totalBytes,
    removeOne,
    removeAll,
  };
}
