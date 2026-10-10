type Translate = (key: string) => string;

/** E3: what a failed moment says, by the server's error code (no credit was used for these). */
export function momentFailureMessage(
  code: string | undefined,
  t: Translate,
): string {
  switch (code) {
    case 'MOMENT_CANCELLED':
    case 'MOMENT_EXPIRED':
      return t('moment.cancelled_no_credit');
    case 'MOMENT_NOT_SUITABLE':
      return t('moment.not_suitable');
    case 'MOMENT_AUTHOR_FAILED':
      return t('moment.author_failed');
    case 'CONTENT_REJECTED':
      return t('moment.content_rejected');
    default:
      return t('moment.generic_failed');
  }
}
