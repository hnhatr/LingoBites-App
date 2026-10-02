import type {LessonCreationState} from './useLessonCreation';

export type CreationErrorDisplay = {
  messageKey: string;
  code: string;
};

/**
 * Maps terminal creation failures to grouped i18n keys (BR-001, DQ-014A).
 * The raw server/client code is always returned for display beside the message.
 */
export function creationErrorDisplay(
  state: LessonCreationState,
): CreationErrorDisplay | null {
  if (state.status === 'failed') {
    return {
      messageKey: state.retryable
        ? 'youtube.create.error_failed_retryable'
        : 'youtube.create.error_failed_final',
      code: state.code,
    };
  }
  if (state.status === 'error') {
    const messageKey =
      state.error.kind === 'network-error'
        ? 'youtube.create.error_network'
        : 'youtube.create.error_default';
    return {
      messageKey,
      code: state.error.errorCode,
    };
  }
  return null;
}
