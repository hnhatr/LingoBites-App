import {isLessonNotDownloaded} from '../lessonNotDownloaded';

describe('isLessonNotDownloaded', () => {
  it('is true when a lesson with no local copy failed on the network', () => {
    expect(
      isLessonNotDownloaded({
        status: 'error',
        error: {
          ok: false,
          kind: 'network-error',
          errorCode: 'NETWORK_ERROR',
          message: 'Network connection lost.',
          retryable: true,
        },
      }),
    ).toBe(true);
  });

  it('is false for other failures', () => {
    expect(
      isLessonNotDownloaded({
        status: 'error',
        error: {
          ok: false,
          kind: 'server-error',
          errorCode: 'INTERNAL',
          message: 'Server error.',
          retryable: true,
        },
      }),
    ).toBe(false);
    expect(
      isLessonNotDownloaded({
        status: 'error',
        error: {message: 'Lesson failed to load.'},
      }),
    ).toBe(false);
    expect(isLessonNotDownloaded({status: 'loading'})).toBe(false);
  });
});
