type Translate = (key: string, options?: Record<string, unknown>) => string;

/** E3: what a failed moment says, by the server's error code (no credit was used for these). */
export function momentFailureMessage(
  code: string | undefined,
  t: Translate,
  limit?: number,
): string {
  switch (code) {
    case 'COMPOSE_LIMIT_REACHED':
      return limit !== undefined
        ? t('moment.limit_reached', {limit})
        : t('moment.limit_reached_plain');
    case 'MOMENT_RUNNING':
      return t('moment.running');
    case 'MOMENT_DISABLED':
      return t('moment.disabled');
    case 'STORE_UNAVAILABLE':
      return t('moment.unavailable');
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

/** Codes whose server message is already written for the learner (Vietnamese). */
const IMAGE_CODES_WITH_LEARNER_MESSAGE = new Set([
  'IMAGE_TOO_LARGE',
  'IMAGE_UNSUPPORTED',
  'IMAGE_REJECTED',
  'OCR_PROVIDER_ERROR',
]);

/** E3: what a failed photo analysis says (`analyzeImage` result). */
export function imageAnalysisFailureMessage(
  failure: {kind: string; errorCode: string; message: string},
  t: Translate,
): string {
  if (failure.errorCode === 'IMAGE_ANALYZE_TIMEOUT') {
    return t('errors.ocr_timeout');
  }
  if (failure.kind === 'network-error') {
    return t('errors.network_lost');
  }
  if (failure.kind === 'auth-error') {
    return t('errors.session_expired');
  }
  if (failure.errorCode === 'RATE_LIMIT_EXCEEDED') {
    return t('errors.rate_limit_exceeded');
  }
  if (IMAGE_CODES_WITH_LEARNER_MESSAGE.has(failure.errorCode)) {
    return failure.message;
  }
  return t('errors.ocr_failed');
}
