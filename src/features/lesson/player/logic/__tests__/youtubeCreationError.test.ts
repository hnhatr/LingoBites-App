import type {LessonCreationState} from '../useLessonCreation';
import {creationErrorDisplay} from '../youtubeCreationError';

describe('creationErrorDisplay (BR-001)', () => {
  it('maps retryable failed creation to the temporary message key', () => {
    const state: LessonCreationState = {
      status: 'failed',
      requestId: 'r1',
      code: 'X_UNKNOWN',
      retryable: true,
    };
    expect(creationErrorDisplay(state)).toEqual({
      messageKey: 'youtube.create.error_failed_retryable',
      code: 'X_UNKNOWN',
    });
  });

  it('maps non-retryable failed creation to the final message key', () => {
    const state: LessonCreationState = {
      status: 'failed',
      requestId: 'r1',
      code: 'NO_SUBTITLES',
      retryable: false,
    };
    expect(creationErrorDisplay(state)).toEqual({
      messageKey: 'youtube.create.error_failed_final',
      code: 'NO_SUBTITLES',
    });
  });

  it('maps network errors to the connection message key', () => {
    const state: LessonCreationState = {
      status: 'error',
      error: {
        ok: false,
        kind: 'network-error',
        errorCode: 'NET_OFFLINE',
        message: 'offline',
        retryable: true,
      },
    };
    expect(creationErrorDisplay(state)).toEqual({
      messageKey: 'youtube.create.error_network',
      code: 'NET_OFFLINE',
    });
  });

  it('maps other client errors to the default message key', () => {
    const state: LessonCreationState = {
      status: 'error',
      error: {
        ok: false,
        kind: 'server-error',
        errorCode: 'SERVER_500',
        message: 'Internal',
        retryable: false,
      },
    };
    expect(creationErrorDisplay(state)).toEqual({
      messageKey: 'youtube.create.error_default',
      code: 'SERVER_500',
    });
  });

  it('returns null for non-error states', () => {
    expect(creationErrorDisplay({status: 'idle'})).toBeNull();
    expect(
      creationErrorDisplay({status: 'processing', requestId: 'r'}),
    ).toBeNull();
  });
});
