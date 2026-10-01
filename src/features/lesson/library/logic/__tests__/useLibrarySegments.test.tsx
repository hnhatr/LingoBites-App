import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {listDownloadedLessonSummaries} from '@features/lesson/player';

import {useLibrarySegments} from '../useLibrarySegments';

jest.mock('@features/lesson/player', () => ({
  listDownloadedLessonSummaries: jest.fn(),
}));

jest.mock('@features/review', () => ({
  listFlashcards: jest.fn(() => []),
  listAllBookmarkedGrammar: jest.fn(() => []),
}));

const mockedDownloads = listDownloadedLessonSummaries as jest.Mock;

function SegmentsProbe() {
  const {packagedLessons} = useLibrarySegments();
  return <>{packagedLessons.length}</>;
}

describe('useLibrarySegments', () => {
  beforeEach(() => {
    mockedDownloads.mockReset();
  });

  it('maps downloaded canonical lessons into packaged lesson cards', async () => {
    mockedDownloads.mockReturnValue([
      {
        lessonId: 'lesson-1',
        title: 'Offline lesson',
        description: 'desc',
        estimatedDurationMinutes: 5,
        downloadedAt: '2026-09-06T00:00:00.000Z',
        snapshot: {sentences: [{text_en: 'Hi', text_vi: 'Chào'}]},
      },
    ]);

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = ReactTestRenderer.create(<SegmentsProbe />);
    });
    expect(tree?.toJSON()).toBe('1');
  });
});
