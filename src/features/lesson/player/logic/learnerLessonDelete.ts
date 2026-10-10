import {removeLessonDownload} from './canonicalDownloadRepository';
import {
  type CanonicalLessonClientOptions,
  type CanonicalLessonResult,
  send,
} from './canonicalLessonClient';

/**
 * E5 (S4): delete one of the learner's own lessons on the server, then drop
 * this device's copy. Keeps the local copy when the server refuses, so nothing
 * is lost on a failed delete.
 */
export async function deleteLearnerLesson(
  lessonId: string,
  options: CanonicalLessonClientOptions = {},
): Promise<CanonicalLessonResult<void>> {
  const answered = await send(
    `/api/v1/lessons/${encodeURIComponent(lessonId)}`,
    {method: 'DELETE'},
    'LESSON_NOT_FOUND',
    options,
  );
  if (!('body' in answered)) return answered;
  if (answered.status < 200 || answered.status >= 300) {
    const message =
      typeof answered.body === 'object' && answered.body !== null
        ? String(
            (answered.body as {error?: {message?: unknown}}).error?.message ??
              'Request failed.',
          )
        : 'Request failed.';
    return {
      ok: false,
      kind: answered.status === 404 ? 'not-found' : 'server-error',
      errorCode: 'LESSON_NOT_FOUND',
      message,
      retryable: answered.status >= 500,
      status: answered.status,
    };
  }
  try {
    removeLessonDownload(lessonId);
  } catch {
    // The server copy is gone; a stale local row is swept on the next sync.
  }
  return {ok: true, value: undefined};
}
