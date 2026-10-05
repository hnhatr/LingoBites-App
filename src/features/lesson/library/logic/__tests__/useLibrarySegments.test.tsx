import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {listDownloadedLessonSummaries} from '@features/lesson/player';
import {listAllBookmarkedGrammar, listFlashcards} from '@features/review';

import {
  isSegmentFilterActive,
  matchesSegmentFilter,
  useLibrarySegments,
  type UseLibrarySegmentsResult,
} from '../useLibrarySegments';
import {makeFlashcard, makeGrammarBookmark} from './fixtures/libraryTestData';

jest.mock('@features/lesson/player', () => ({
  listDownloadedLessonSummaries: jest.fn(),
  collectLessonGrammar: jest.fn(() => []),
}));

jest.mock('@features/review', () => ({
  listFlashcards: jest.fn(() => []),
  listAllBookmarkedGrammar: jest.fn(() => []),
}));

const mockedDownloads = listDownloadedLessonSummaries as jest.Mock;
const mockedFlashcards = listFlashcards as jest.Mock;
const mockedGrammar = listAllBookmarkedGrammar as jest.Mock;

function download(lessonId: string, sourceType: string) {
  return {
    lessonId,
    title: `Lesson ${lessonId}`,
    description: 'desc',
    estimatedDurationMinutes: 5,
    downloadedAt: '2026-09-06T00:00:00.000Z',
    snapshot: {
      source_type: sourceType,
      sentences: [{text_en: 'Hi', text_vi: 'Chào'}],
      analyses: [],
    },
  };
}

let latest: UseLibrarySegmentsResult;

function SegmentsProbe() {
  latest = useLibrarySegments();
  return null;
}

async function renderProbe() {
  await act(async () => {
    ReactTestRenderer.create(<SegmentsProbe />);
  });
}

describe('useLibrarySegments', () => {
  beforeEach(() => {
    mockedDownloads.mockReset();
    mockedFlashcards.mockReset().mockReturnValue([]);
    mockedGrammar.mockReset().mockReturnValue([]);
  });

  it('maps downloaded lessons with their real source_type', async () => {
    mockedDownloads.mockReturnValue([download('lesson-1', 'youtube')]);

    await renderProbe();

    expect(latest.packagedLessons).toHaveLength(1);
    expect(latest.packagedLessons[0].sourceType).toBe('youtube');
  });

  it('filters lessons, words and grammar by the source of their lesson', async () => {
    mockedDownloads.mockReturnValue([
      download('ocr-lesson', 'learner_ocr'),
      download('admin-lesson', 'admin_text'),
    ]);
    mockedFlashcards.mockReturnValue([
      makeFlashcard({id: 'c1', lessonId: 'ocr-lesson'}),
      makeFlashcard({id: 'c2', lessonId: 'admin-lesson'}),
      makeFlashcard({id: 'c3', lessonId: 'unknown-lesson'}),
    ]);
    mockedGrammar.mockReturnValue([
      makeGrammarBookmark({grammarId: 'g1', lessonId: 'admin-lesson'}),
      makeGrammarBookmark({grammarId: 'g2', lessonId: 'ocr-lesson'}),
    ]);

    await renderProbe();
    expect(latest.vocabulary).toHaveLength(3);

    await act(async () => {
      latest.setLessonsFilter({searchQuery: '', sourceFilter: 'learner_ocr'});
      latest.setVocabularyFilter({
        searchQuery: '',
        sourceFilter: 'learner_ocr',
      });
      latest.setGrammarFilter({searchQuery: '', sourceFilter: 'admin_text'});
    });

    expect(latest.packagedLessons.map(l => l.id)).toEqual(['ocr-lesson']);
    expect(latest.vocabulary.map(c => c.id)).toEqual(['c1']);
    expect(latest.grammar.map(g => g.grammarId)).toEqual(['g1']);
  });
});

describe('matchesSegmentFilter', () => {
  const item = {texts: ['Hello world', null], sourceType: 'youtube' as const};

  it('matches search text case-insensitively and the exact source', () => {
    expect(
      matchesSegmentFilter({searchQuery: 'WORLD', sourceFilter: 'all'}, item),
    ).toBe(true);
    expect(
      matchesSegmentFilter({searchQuery: '', sourceFilter: 'youtube'}, item),
    ).toBe(true);
    expect(
      matchesSegmentFilter({searchQuery: '', sourceFilter: 'admin_text'}, item),
    ).toBe(false);
    expect(
      matchesSegmentFilter({searchQuery: 'nope', sourceFilter: 'all'}, item),
    ).toBe(false);
  });

  it('only shows items with an unknown source under "all"', () => {
    const unknown = {texts: ['x'], sourceType: undefined};
    expect(
      matchesSegmentFilter({searchQuery: '', sourceFilter: 'all'}, unknown),
    ).toBe(true);
    expect(
      matchesSegmentFilter({searchQuery: '', sourceFilter: 'youtube'}, unknown),
    ).toBe(false);
  });

  it('reports whether a filter is active', () => {
    expect(
      isSegmentFilterActive({searchQuery: '  ', sourceFilter: 'all'}),
    ).toBe(false);
    expect(isSegmentFilterActive({searchQuery: 'a', sourceFilter: 'all'})).toBe(
      true,
    );
    expect(
      isSegmentFilterActive({searchQuery: '', sourceFilter: 'youtube'}),
    ).toBe(true);
  });
});
