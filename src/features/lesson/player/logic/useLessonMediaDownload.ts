import {useCallback, useEffect, useState} from 'react';

import type {LessonSnapshot} from '@core/schemas/lesson';

import {
  getLessonMediaDir,
  removeLessonMedia,
  setLessonMediaDir,
  stageLessonMedia,
  sweepLessonMedia,
} from './canonicalDownloadRepository';
import {lessonMediaUrls} from './mediaDownloadConsent';

/**
 * `none`: the lesson has no media. `missing`: media not on the device.
 * `saved`: media stored for offline study.
 */
export type LessonMediaStatus =
  | 'none'
  | 'missing'
  | 'downloading'
  | 'saved'
  | 'failed';

function readStatus(snapshot: LessonSnapshot | null): LessonMediaStatus {
  if (!snapshot || lessonMediaUrls(snapshot).length === 0) return 'none';
  return getLessonMediaDir(snapshot.id) ? 'saved' : 'missing';
}

/**
 * The learner-driven media download of one stored lesson ("Tải để học
 * offline" / "Xoá"). The lesson text is already stored; this only adds or
 * removes the heavier media files.
 */
export function useLessonMediaDownload(snapshot: LessonSnapshot | null) {
  const [status, setStatus] = useState<LessonMediaStatus>(() =>
    readStatus(snapshot),
  );

  useEffect(() => {
    setStatus(readStatus(snapshot));
  }, [snapshot]);

  const download = useCallback(async () => {
    if (!snapshot) return;
    const urls = lessonMediaUrls(snapshot);
    if (urls.length === 0) return;
    setStatus('downloading');
    let saved = false;
    try {
      const mediaDir = await stageLessonMedia(
        snapshot.id,
        snapshot.content_revision,
        urls,
      );
      saved =
        mediaDir !== null &&
        setLessonMediaDir(snapshot.id, snapshot.content_revision, mediaDir);
    } catch {
      saved = false;
    }
    try {
      // Drops partial files of a failed download.
      await sweepLessonMedia();
    } catch {
      // Best-effort cleanup.
    }
    setStatus(saved ? 'saved' : 'failed');
  }, [snapshot]);

  const remove = useCallback(async () => {
    if (!snapshot) return;
    removeLessonMedia(snapshot.id);
    try {
      await sweepLessonMedia();
    } catch {
      // Best-effort cleanup; the row no longer points at the files.
    }
    setStatus(readStatus(snapshot));
  }, [snapshot]);

  return {status, download, remove};
}
