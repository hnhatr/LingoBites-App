import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {
  getLessonDownloadsSignature,
  listDownloadedLessonSummaries,
} from '@features/lesson/player';
import {
  listAllBookmarkedGrammar,
  listFlashcards,
  listFlashcardSources,
} from '@features/review';

import {
  isSegmentFilterActive,
  matchesSegmentFilter,
  useLibrarySegments,
  type UseLibrarySegmentsResult,
} from '../useLibrarySegments';
import {makeFlashcard, makeGrammarBookmark} from './fixtures/libraryTestData';

jest.mock('@features/lesson/player', () => ({
  listDownloadedLessonSummaries: jest.fn(),
  getLessonDownloadsSignature: jest.fn(() => 'downloads-v1'),
  collectLessonGrammar: jest.fn(() => []),
}));

jest.mock('@features/review', () => ({
  getSavedFlashcardsSignature: jest.fn(() => ({count: 0, signature: ''})),
  getBookmarkedGrammarSignature: jest.fn(() => ({count: 0, signature: ''})),
  listFlashcards: jest.fn(() => []),
  listFlashcardSources: jest.fn(() => new Map()),
  listAllBookmarkedGrammar: jest.fn(() => []),
}));

const mockedDownloads = listDownloadedLessonSummaries as jest.Mock;
const mockedFlashcards = listFlashcards as jest.Mock;
const mockedGrammar = listAllBookmarkedGrammar as jest.Mock;
const mockedSources = listFlashcardSources as jest.Mock;

function download(lessonId: string, sourceType: string) {
  return {
    lessonId,
    title: `Lesson ${lessonId}`,
    description: 'desc',
    estimatedDurationMinutes: 5,
    downloadedAt: '2026-09-06T00:00:00.000Z',
    snapshot: {
      id: lessonId,
      content_revision: 1,
      source_type: sourceType,
      sentences: [
        {id: `${lessonId}-s1`, position: 0, text_en: 'Hi', text_vi: 'Chào'},
      ],
      blocks: [],
      analyses: {},
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
    mockedSources.mockReset().mockReturnValue(new Map());
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

describe('useLibrarySegments practice readiness', () => {
  beforeEach(() => {
    mockedDownloads.mockReset();
    mockedFlashcards.mockReset().mockReturnValue([]);
    mockedGrammar.mockReset().mockReturnValue([]);
    mockedSources.mockReset().mockReturnValue(new Map());
  });

  it('marks only lessons big enough for a quiz as practice-ready', async () => {
    const big = download('big', 'learner_text');
    big.snapshot.sentences = ['a', 'b', 'c', 'd'].map((letter, index) => ({
      id: `big-${letter}`,
      position: index,
      text_en: `Sentence ${letter}.`,
      text_vi: `Câu ${letter}.`,
    }));
    mockedDownloads.mockReturnValue([big, download('tiny', 'learner_text')]);

    await renderProbe();

    expect(
      Object.fromEntries(
        latest.packagedLessons.map(l => [l.id, l.practiceReady]),
      ),
    ).toEqual({big: true, tiny: false});
  });
});

describe('useLibrarySegments word sources', () => {
  beforeEach(() => {
    mockedDownloads.mockReset();
    mockedFlashcards.mockReset().mockReturnValue([]);
    mockedGrammar.mockReset().mockReturnValue([]);
    mockedSources.mockReset().mockReturnValue(new Map());
  });

  const source = (lessonId: string) => ({
    lessonId,
    sourceSentence: null,
    createdAt: '2026-10-01T00:00:00.000Z',
  });

  it('lists every lesson a shared word came from, with titles and sources', async () => {
    mockedDownloads.mockReturnValue([
      download('ocr-lesson', 'learner_ocr'),
      download('admin-lesson', 'admin_text'),
    ]);
    mockedFlashcards.mockReturnValue([
      makeFlashcard({id: 'c1', lessonId: 'ocr-lesson'}),
    ]);
    mockedSources.mockReturnValue(
      new Map([
        ['c1', [source('ocr-lesson'), source('admin-lesson'), source('gone')]],
      ]),
    );

    await renderProbe();

    expect(latest.vocabulary[0]!.sources).toEqual([
      {
        lessonId: 'ocr-lesson',
        title: 'Lesson ocr-lesson',
        sourceType: 'learner_ocr',
      },
      {
        lessonId: 'admin-lesson',
        title: 'Lesson admin-lesson',
        sourceType: 'admin_text',
      },
      {lessonId: 'gone', title: null, sourceType: undefined},
    ]);
  });

  it('falls back to the card own lesson when it has no source rows', async () => {
    mockedDownloads.mockReturnValue([download('lesson-1', 'youtube')]);
    mockedFlashcards.mockReturnValue([
      makeFlashcard({id: 'legacy', lessonId: 'lesson-1'}),
    ]);

    await renderProbe();

    expect(latest.vocabulary[0]!.sources).toEqual([
      {lessonId: 'lesson-1', title: 'Lesson lesson-1', sourceType: 'youtube'},
    ]);
  });

  it('matches a source filter through any lesson of a shared word', async () => {
    mockedDownloads.mockReturnValue([
      download('ocr-lesson', 'learner_ocr'),
      download('admin-lesson', 'admin_text'),
    ]);
    mockedFlashcards.mockReturnValue([
      // Saved first from the OCR lesson, also found in the admin lesson.
      makeFlashcard({id: 'shared', lessonId: 'ocr-lesson'}),
      makeFlashcard({id: 'ocr-only', lessonId: 'ocr-lesson'}),
    ]);
    mockedSources.mockReturnValue(
      new Map([
        ['shared', [source('ocr-lesson'), source('admin-lesson')]],
        ['ocr-only', [source('ocr-lesson')]],
      ]),
    );

    await renderProbe();
    await act(async () => {
      latest.setVocabularyFilter({searchQuery: '', sourceFilter: 'admin_text'});
    });

    expect(latest.vocabulary.map(card => card.id)).toEqual(['shared']);
  });
});

describe('useLibrarySegments refresh', () => {
  const mockedSignature = getLessonDownloadsSignature as jest.Mock;

  beforeEach(() => {
    mockedDownloads.mockReset().mockReturnValue([]);
    mockedSignature.mockReset().mockReturnValue('downloads-v1');
  });

  it('does not reload when nothing changed since the last load', async () => {
    await renderProbe();
    expect(mockedDownloads).toHaveBeenCalledTimes(1);

    act(() => latest.refresh());

    expect(mockedDownloads).toHaveBeenCalledTimes(1);
  });

  it('reloads once something new was downloaded', async () => {
    await renderProbe();
    mockedDownloads.mockReturnValue([download('lesson-new', 'learner_text')]);
    mockedSignature.mockReturnValue('downloads-v2');

    act(() => latest.refresh());

    expect(mockedDownloads).toHaveBeenCalledTimes(2);
    expect(latest.packagedLessons.map(card => card.id)).toEqual(['lesson-new']);
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
