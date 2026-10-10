import {
  type CanonicalLessonClientOptions,
  type CanonicalLessonResult,
  contentError,
  errorFromStatus,
  send,
} from './canonicalLessonClient';

/** E6 (R1): the reasons a learner can give for a wrong word in a photo lesson. */
export const ITEM_REPORT_REASONS = [
  'not_in_image',
  'wrong_meaning',
  'other',
] as const;
export type ItemReportReason = (typeof ITEM_REPORT_REASONS)[number];

/**
 * E6: tell the server a word of one of the learner's photo lessons is wrong.
 * `recorded` is false when this learner already reported that word.
 */
export async function reportLessonItem(
  lessonId: string,
  itemCode: string,
  reason: ItemReportReason,
  options: CanonicalLessonClientOptions = {},
): Promise<CanonicalLessonResult<{recorded: boolean}>> {
  const answered = await send(
    `/api/v1/lessons/${encodeURIComponent(lessonId)}/items/${encodeURIComponent(
      itemCode,
    )}/report`,
    {
      method: 'POST',
      headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
      body: JSON.stringify({reason}),
    },
    'REPORT_NOT_AVAILABLE',
    options,
  );
  if (!('body' in answered)) return answered;
  if (answered.status < 200 || answered.status >= 300) {
    return errorFromStatus(
      answered.status,
      answered.body,
      'REPORT_NOT_AVAILABLE',
    );
  }
  const recorded = (answered.body as {recorded?: unknown}).recorded;
  if (typeof recorded !== 'boolean') {
    return contentError('Report answer failed validation.');
  }
  return {ok: true, value: {recorded}};
}
