import {useCallback, useMemo, useState} from 'react';
import {useContentLibrary} from '@modules/content';
import {
  listSavedLessons,
  listStartedLessons,
} from '@shared/db/ContentLessonStateRepository';
import {listAllBookmarkedGrammar} from '@shared/db/GrammarBookmarkRepository';
import {listFlashcards} from '@shared/db/FlashcardRepository';
import type {FlashcardRecord, GrammarBookmark} from '@shared/db/types';
import type {LibraryLessonCardView} from '@/types/lesson';

export interface SegmentFilterState {
  searchQuery: string;
  sourceFilter: 'all' | 'offline' | 'image_ocr' | 'paste';
}

export interface UseLibrarySegmentsResult {
  personalLessons: LibraryLessonCardView[];
  packagedLessons: any[];
  vocabulary: FlashcardRecord[];
  grammar: (GrammarBookmark & {title?: string; content?: string})[];
  lessonsFilter: SegmentFilterState;
  vocabularyFilter: SegmentFilterState;
  grammarFilter: SegmentFilterState;
  setLessonsFilter: (filter: SegmentFilterState) => void;
  setVocabularyFilter: (filter: SegmentFilterState) => void;
  setGrammarFilter: (filter: SegmentFilterState) => void;
  refresh: () => void;
}

export function useLibrarySegments(): UseLibrarySegmentsResult {
  const {listActivePackageLessons} = useContentLibrary();
  const [refreshVersion, setRefreshVersion] = useState(0);

  const [lessonsFilter, setLessonsFilter] = useState<SegmentFilterState>({
    searchQuery: '',
    sourceFilter: 'all',
  });
  const [vocabularyFilter, setVocabularyFilter] = useState<SegmentFilterState>({
    searchQuery: '',
    sourceFilter: 'all',
  });
  const [grammarFilter, setGrammarFilter] = useState<SegmentFilterState>({
    searchQuery: '',
    sourceFilter: 'all',
  });

  const refresh = useCallback(() => {
    setRefreshVersion(v => v + 1);
  }, []);

  // Personal lessons (legacy v1/v2 personal lessons removed; canonical uses UnifiedLessonsScreen)
  const personalLessons = useMemo(() => [], []);

  // Packaged lessons (from ContentLessonStateRepository)
  const packagedLessons = useMemo(() => {
    const savedLessons = listSavedLessons();
    const startedLessons = listStartedLessons();
    const combined = [...savedLessons, ...startedLessons];
    const deduped = Array.from(
      new Map(combined.map(l => [l.lessonId, l])).values()
    );

    // Enrich with content library metadata
    const activePackageLessons = listActivePackageLessons();
    const enriched = deduped.map(state => {
      const contentItem = activePackageLessons.find(
        item => item.id === state.lessonId
      );
      return {...contentItem, ...state};
    });

    return filterLessonsByQueryAndSource(enriched, lessonsFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonsFilter, refreshVersion]);

  // Vocabulary (saved flashcards)
  const vocabulary = useMemo(() => {
    const cards = listFlashcards({includeUnsaved: false});
    return filterBySearchAndSource(cards, vocabularyFilter, {
      searchFields: ['word', 'meaningVi', 'example'],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocabularyFilter, refreshVersion]);

  // Grammar (saved bookmarks)
  const grammar = useMemo(() => {
    const bookmarks = listAllBookmarkedGrammar();
    return filterBySearchAndSource(bookmarks, grammarFilter, {
      searchFields: ['title', 'content'],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grammarFilter, refreshVersion]);

  return {
    personalLessons,
    packagedLessons,
    vocabulary,
    grammar,
    lessonsFilter,
    vocabularyFilter,
    grammarFilter,
    setLessonsFilter,
    setVocabularyFilter,
    setGrammarFilter,
    refresh,
  };
}

// Helper: filter lessons by search + source
function filterLessonsByQueryAndSource(
  lessons: any[],
  filter: SegmentFilterState
): any[] {
  return lessons.filter(lesson => {
    const matchesSearch =
      !filter.searchQuery ||
      lesson.title?.toLowerCase().includes(filter.searchQuery.toLowerCase()) ||
      lesson.summary?.toLowerCase().includes(filter.searchQuery.toLowerCase()) ||
      lesson.blurb?.toLowerCase().includes(filter.searchQuery.toLowerCase());

    const matchesSource =
      filter.sourceFilter === 'all' ||
      normalizeSourceType(lesson.sourceType) === filter.sourceFilter;

    return matchesSearch && matchesSource;
  });
}

// Helper: filter by search + source (generic)
function filterBySearchAndSource(
  items: any[],
  filter: SegmentFilterState,
  options: {searchFields: string[]}
): any[] {
  return items.filter(item => {
    const matchesSearch =
      !filter.searchQuery ||
      options.searchFields.some(field =>
        item[field]?.toLowerCase?.().includes(filter.searchQuery.toLowerCase())
      );

    const matchesSource =
      filter.sourceFilter === 'all' ||
      normalizeSourceType(item.sourceType) === filter.sourceFilter;

    return matchesSearch && matchesSource;
  });
}

// Helper: normalize source types (camera/gallery -> image_ocr, paste_text -> paste)
function normalizeSourceType(sourceType: string | undefined): string {
  if (!sourceType) return 'all';
  if (sourceType === 'camera' || sourceType === 'gallery') {
    return 'image_ocr';
  }
  if (sourceType === 'paste_text') {
    return 'paste';
  }
  return sourceType;
}
