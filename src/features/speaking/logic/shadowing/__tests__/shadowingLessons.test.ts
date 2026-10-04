import type {LessonSentence} from '@core/schemas/lesson';

import {
  loadShadowingLessonSnapshot,
  orderShadowingSentences,
} from '../shadowingLessons';

const LESSON_ID = '11111111-1111-4111-8111-111111111111';

jest.mock('@features/lesson/player', () => ({
  listDownloadedLessonSummaries: jest.fn(),
}));

const {listDownloadedLessonSummaries} = jest.requireMock(
  '@features/lesson/player',
) as {listDownloadedLessonSummaries: jest.Mock};

function sentence(
  id: string,
  position: number,
  overrides?: Partial<LessonSentence>,
): LessonSentence {
  return {
    id,
    position,
    text_en: `en-${position}`,
    text_vi: `vi-${position}`,
    ipa: `/ipa-${position}/`,
    start_ms: null,
    end_ms: null,
    ...overrides,
  };
}

describe('orderShadowingSentences', () => {
  it('AC-004 S3: orders sentences by ascending position', () => {
    const ordered = orderShadowingSentences([
      sentence('b', 2),
      sentence('a', 0),
      sentence('c', 1),
    ]);
    expect(ordered.map(s => s.position)).toEqual([0, 1, 2]);
    expect(ordered.map(s => s.id)).toEqual(['a', 'c', 'b']);
  });
});

describe('loadShadowingLessonSnapshot', () => {
  beforeEach(() => {
    listDownloadedLessonSummaries.mockReset();
  });

  it('returns null when the lesson is not downloaded', () => {
    listDownloadedLessonSummaries.mockReturnValue([]);
    expect(loadShadowingLessonSnapshot(LESSON_ID)).toBeNull();
  });

  it('returns sorted sentences for a downloaded lesson', () => {
    listDownloadedLessonSummaries.mockReturnValue([
      {
        lessonId: LESSON_ID,
        title: 'Bài mẫu',
        slug: 'sample',
        description: '',
        estimatedDurationMinutes: 5,
        downloadedAt: '2026-10-04T00:00:00.000Z',
        snapshot: {
          id: LESSON_ID,
          slug: 'sample',
          title: 'Bài mẫu',
          description: '',
          origin: 'canonical',
          source_type: 'text',
          content_revision: 1,
          unit: null,
          youtube: null,
          blocks: [],
          analyses: {},
          sentences: [sentence('s2', 2), sentence('s0', 0)],
        },
      },
    ]);
    const snapshot = loadShadowingLessonSnapshot(LESSON_ID);
    expect(snapshot?.sentences.map(s => s.position)).toEqual([0, 2]);
  });
});
