import {findVideoInProgress} from '../videoHub';

let mockSummaries: unknown[] = [];
let mockInProgressIds: string[] = [];

jest.mock('@features/lesson/player', () => ({
  listDownloadedLessonSummaries: () => mockSummaries,
}));

jest.mock('@core/sync/lessonProgress', () => ({
  listInProgressLessonIds: () => mockInProgressIds,
}));

function summary(lessonId: string, sourceType: string) {
  return {
    lessonId,
    title: `Lesson ${lessonId}`,
    snapshot: {
      source_type: sourceType,
      sentences: [{}, {}],
      youtube:
        sourceType === 'youtube' ? {video_id: 'v', duration_ms: 60_000} : null,
    },
  };
}

describe('findVideoInProgress', () => {
  it('returns the most recent in-progress YouTube lesson', () => {
    mockSummaries = [
      summary('text-1', 'admin_text'),
      summary('yt-1', 'youtube'),
      summary('yt-2', 'youtube'),
    ];
    mockInProgressIds = ['text-1', 'yt-2', 'yt-1'];
    expect(findVideoInProgress()).toEqual({
      lessonId: 'yt-2',
      title: 'Lesson yt-2',
      sentenceCount: 2,
      youtubeDurationMs: 60_000,
    });
  });

  it('returns null when no video is in progress', () => {
    mockSummaries = [summary('yt-1', 'youtube')];
    mockInProgressIds = ['other'];
    expect(findVideoInProgress()).toBeNull();
  });
});
