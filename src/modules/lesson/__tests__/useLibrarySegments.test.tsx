import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { useLibrarySegments, UseLibrarySegmentsResult } from '../useLibrarySegments';
import { listSavedLessons, listStartedLessons } from '@shared/db/ContentLessonStateRepository';
import { listAllBookmarkedGrammar } from '@shared/db/GrammarBookmarkRepository';
import { listFlashcards } from '@shared/db/FlashcardRepository';
import { useContentLibrary } from '@modules/content';

jest.mock('@shared/db/ContentLessonStateRepository', () => ({
  listSavedLessons: jest.fn(),
  listStartedLessons: jest.fn(),
}));

jest.mock('@shared/db/GrammarBookmarkRepository', () => ({
  listAllBookmarkedGrammar: jest.fn(),
}));

jest.mock('@shared/db/FlashcardRepository', () => ({
  listFlashcards: jest.fn(),
}));

jest.mock('@modules/content', () => ({
  useContentLibrary: jest.fn(),
}));

function TestWrapper({ hookRef }: { hookRef: { current: UseLibrarySegmentsResult } }) {
  hookRef.current = useLibrarySegments();
  return null;
}

describe('useLibrarySegments', () => {
  let mockListActivePackageLessons: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    (listSavedLessons as jest.Mock).mockReturnValue([
      { lessonId: 'lesson-1', isSaved: true, isStarted: false, updatedAt: '2026-01-01T00:00:00Z' },
    ]);
    (listStartedLessons as jest.Mock).mockReturnValue([
      { lessonId: 'lesson-2', isSaved: false, isStarted: true, updatedAt: '2026-01-02T00:00:00Z' },
    ]);
    (listAllBookmarkedGrammar as jest.Mock).mockReturnValue([
      {
        lessonId: 'lesson-1',
        grammarId: 'g1',
        packageId: 'pkg1',
        savedAt: '2026-01-01T00:00:00Z',
        reactivatedAt: '2026-01-01T00:00:00Z',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        title: 'Present Perfect',
        content: 'Action in the past with relevance now',
        sourceType: 'offline',
      },
    ]);
    (listFlashcards as jest.Mock).mockReturnValue([
      {
        id: 'card-1',
        lessonId: 'lesson-1',
        vocabularyId: 'v1',
        word: 'Ubiquitous',
        meaningVi: 'Phổ biến',
        example: 'Smartphones are ubiquitous.',
        isSaved: true,
        sourceType: 'camera',
      },
      {
        id: 'card-2',
        lessonId: 'lesson-2',
        vocabularyId: 'v2',
        word: 'Ephemeral',
        meaningVi: 'Phù du',
        example: 'Fame can be ephemeral.',
        isSaved: true,
        sourceType: 'paste_text',
      },
    ]);

    mockListActivePackageLessons = jest.fn().mockReturnValue([
      { id: 'lesson-1', title: 'Basic English', summary: 'Intro to basic words', sourceType: 'offline' },
      { id: 'lesson-2', title: 'Advanced Grammar', summary: 'Deep dive into tense', sourceType: 'paste_text' },
    ]);
    (useContentLibrary as jest.Mock).mockReturnValue({
      listActivePackageLessons: mockListActivePackageLessons,
    });
  });

  function renderHook() {
    const hookRef = { current: null as unknown as UseLibrarySegmentsResult };
    let tree!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      tree = ReactTestRenderer.create(<TestWrapper hookRef={hookRef} />);
    });
    return {
      get current() {
        return hookRef.current;
      },
      rerender() {
        act(() => {
          tree.update(<TestWrapper hookRef={hookRef} />);
        });
      },
    };
  }

  it('renders hook and fetches initial lessons, vocabulary, and grammar data', () => {
    const hook = renderHook();

    expect(hook.current.packagedLessons).toHaveLength(2);
    expect(hook.current.packagedLessons[0].lessonId).toBe('lesson-1');
    expect(hook.current.packagedLessons[0].title).toBe('Basic English');
    expect(hook.current.packagedLessons[1].lessonId).toBe('lesson-2');

    expect(hook.current.vocabulary).toHaveLength(2);
    expect(hook.current.vocabulary[0].word).toBe('Ubiquitous');

    expect(hook.current.grammar).toHaveLength(1);
    expect(hook.current.grammar[0].title).toBe('Present Perfect');
  });

  it('filters packaged lessons by searchQuery and sourceFilter', () => {
    const hook = renderHook();

    act(() => {
      hook.current.setLessonsFilter({ searchQuery: 'Basic', sourceFilter: 'all' });
    });
    expect(hook.current.packagedLessons).toHaveLength(1);
    expect(hook.current.packagedLessons[0].lessonId).toBe('lesson-1');

    act(() => {
      hook.current.setLessonsFilter({ searchQuery: '', sourceFilter: 'paste' });
    });
    expect(hook.current.packagedLessons).toHaveLength(1);
    expect(hook.current.packagedLessons[0].lessonId).toBe('lesson-2');
  });

  it('filters vocabulary by searchQuery and normalized sourceFilter', () => {
    const hook = renderHook();

    // 'camera' is normalized to 'image_ocr'
    act(() => {
      hook.current.setVocabularyFilter({ searchQuery: '', sourceFilter: 'image_ocr' });
    });
    expect(hook.current.vocabulary).toHaveLength(1);
    expect(hook.current.vocabulary[0].word).toBe('Ubiquitous');

    act(() => {
      hook.current.setVocabularyFilter({ searchQuery: 'Phù du', sourceFilter: 'all' });
    });
    expect(hook.current.vocabulary).toHaveLength(1);
    expect(hook.current.vocabulary[0].word).toBe('Ephemeral');
  });

  it('filters grammar bookmarks by searchQuery and sourceFilter', () => {
    const hook = renderHook();

    act(() => {
      hook.current.setGrammarFilter({ searchQuery: 'Perfect', sourceFilter: 'all' });
    });
    expect(hook.current.grammar).toHaveLength(1);

    act(() => {
      hook.current.setGrammarFilter({ searchQuery: 'NonExistent', sourceFilter: 'all' });
    });
    expect(hook.current.grammar).toHaveLength(0);
  });

  it('re-evaluates data when refresh is invoked', () => {
    const hook = renderHook();
    expect(hook.current.packagedLessons).toHaveLength(2);

    // Update repository mocks
    (listSavedLessons as jest.Mock).mockReturnValue([]);
    (listStartedLessons as jest.Mock).mockReturnValue([]);

    act(() => {
      hook.current.refresh();
    });

    expect(hook.current.packagedLessons).toHaveLength(0);
  });
});
