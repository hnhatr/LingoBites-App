import {useCallback, useState} from 'react';

import {getDatabase} from '@core/db/database';
import type {LessonSnapshot} from '@core/schemas/lesson';

import {
  applyLessonRevisionStates,
  getLessonDownload,
  InvalidLessonSnapshotError,
  type LessonDownloadRecord,
  saveLessonSnapshotBody,
  stageLessonMedia,
  sweepLessonMedia,
} from './canonicalDownloadRepository';
import {
  type CanonicalLessonError,
  fetchLessonRevisions,
  fetchLessonSnapshot,
  fetchSentenceAnalysis,
} from './canonicalLessonClient';
import {
  lessonMediaUrls,
  readMediaDownloadConsent,
} from './mediaDownloadConsent';

export type CanonicalLessonViewState =
  | {status: 'idle'}
  | {status: 'loading'}
  | {
      status: 'ready';
      snapshot: LessonSnapshot;
      offline: boolean;
      hasUpdate: boolean;
    }
  | {status: 'archived'}
  | {status: 'contract-mismatch'}
  | {status: 'error'; error: CanonicalLessonError | {message: string}};

/**
 * Media to store with a freshly fetched snapshot. Media already on the
 * device for this revision is kept; new media is only downloaded with the
 * learner's `auto` consent. A failed media download never blocks the lesson:
 * the text opens and the learner can retry from the lesson.
 */
async function mediaDirForOpen(
  snapshot: LessonSnapshot,
  previous: LessonDownloadRecord | null,
): Promise<string | null> {
  const urls = lessonMediaUrls(snapshot);
  if (urls.length === 0) return null;
  if (
    previous?.mediaDir &&
    previous.contentRevision === snapshot.content_revision
  ) {
    return previous.mediaDir;
  }
  if (readMediaDownloadConsent() !== 'auto') return null;
  try {
    return await stageLessonMedia(snapshot.id, snapshot.content_revision, urls);
  } catch {
    return null;
  }
}

/**
 * Canonical lesson open flow (AD-005/AD-007): prefer the network snapshot,
 * validate the whole body, stage media, then swap the single SQLite row;
 * fall back to the stored download offline. A failed redownload keeps the
 * old copy; an archived copy is surfaced only after a positive `gone`.
 */
export function useCanonicalLesson(lessonId: string) {
  const [state, setState] = useState<CanonicalLessonViewState>({
    status: 'idle',
  });

  const open = useCallback(async () => {
    setState({status: 'loading'});
    const db = getDatabase();
    const fetched = await fetchLessonSnapshot(lessonId);
    if (fetched.ok) {
      const previousCopy = getLessonDownload(lessonId, db);
      const mediaDir = await mediaDirForOpen(
        fetched.value.snapshot,
        previousCopy,
      );
      try {
        // The validated server body is stored verbatim (AD-005).
        const stored = saveLessonSnapshotBody(
          {body: fetched.value.rawBody, mediaDir},
          db,
        );
        await sweepLessonMedia(db);
        setState({
          status: 'ready',
          snapshot: stored.snapshot,
          offline: false,
          hasUpdate: stored.serverRevision !== null,
        });
        return;
      } catch (error) {
        // A failed redownload (invalid body) keeps the previous copy when
        // one exists (INV-007).
        const previous = getLessonDownload(lessonId, db);
        if (previous) {
          setState({
            status: 'ready',
            snapshot: previous.snapshot,
            offline: true,
            hasUpdate: previous.serverRevision !== null,
          });
          return;
        }
        if (error instanceof InvalidLessonSnapshotError) {
          setState({status: 'contract-mismatch'});
          return;
        }
        setState({status: 'error', error: {message: 'Lesson failed to load.'}});
        return;
      }
    }
    if (
      fetched.kind === 'content-error' ||
      fetched.kind === 'contract-mismatch'
    ) {
      setState({status: 'contract-mismatch'});
      return;
    }
    const stored = getLessonDownload(lessonId, db);
    if (stored) {
      setState({
        status: 'ready',
        snapshot: stored.snapshot,
        offline: true,
        hasUpdate: stored.serverRevision !== null,
      });
      return;
    }
    setState({status: 'error', error: fetched});
  }, [lessonId]);

  const checkForUpdate = useCallback(async () => {
    const db = getDatabase();
    const result = await fetchLessonRevisions([lessonId]);
    if (!result.ok) return;
    const applied = applyLessonRevisionStates(result.value, db);
    await sweepLessonMedia(db);
    if (applied.removed.length > 0) {
      setState({status: 'archived'});
      return;
    }
    setState(previous =>
      previous.status === 'ready' && applied.markedUpdate.length > 0
        ? {...previous, hasUpdate: true}
        : previous,
    );
  }, [lessonId]);

  const requestAnalysis = useCallback(
    async (sentenceId: string) => fetchSentenceAnalysis(lessonId, sentenceId),
    [lessonId],
  );

  return {state, open, checkForUpdate, requestAnalysis};
}
