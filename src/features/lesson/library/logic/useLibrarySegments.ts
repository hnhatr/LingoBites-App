import {useCallback, useMemo, useState} from 'react';

import type {LibraryLessonCardView} from '@features/lesson/library/logic/lesson';
import {listDownloadedLessonSummaries} from '@features/lesson/player';
import {listAllBookmarkedGrammar, listFlashcards} from '@features/review';

import type {FlashcardRecord, GrammarBookmark} from '@core/db/types';

export interface SegmentFilterState {
  searchQuery: string;
  sourceFilter: 'all' | 'offline' | 'image_ocr' | 'paste';
}

export interface UseLibrarySegmentsResult {
  packagedLessons: LibraryLessonCardView[];
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

  const packagedLessons = useMemo(() => {
    const cards: LibraryLessonCardView[] = listDownloadedLessonSummaries().map(
      item => ({
        id: item.lessonId,
        title: item.title,
        blurb: item.description,
        dateLabel: item.downloadedAt.slice(0, 10),
        vocabularyCount: item.snapshot.sentences.length,
        durationMin: item.estimatedDurationMinutes,
        subjectLabel: 'Offline',
        subjectTone: 'neutral' as const,
        subjectKey: 'conversation' as const,
      }),
    );
    return filterLessonsByQueryAndSource(cards, lessonsFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonsFilter, refreshVersion]);

  const vocabulary = useMemo(() => {
    const cards = listFlashcards({includeUnsaved: false});
    return filterBySearchAndSource(cards, vocabularyFilter, {
      searchFields: ['word', 'meaningVi', 'example'],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocabularyFilter, refreshVersion]);

  const grammar = useMemo(() => {
    const bookmarks = listAllBookmarkedGrammar();
    return filterBySearchAndSource(bookmarks, grammarFilter, {
      searchFields: ['title', 'content'],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grammarFilter, refreshVersion]);

  return {
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

function filterLessonsByQueryAndSource(
  lessons: LibraryLessonCardView[],
  filter: SegmentFilterState,
): LibraryLessonCardView[] {
  return lessons.filter(lesson => {
    const matchesSearch =
      !filter.searchQuery ||
      lesson.title?.toLowerCase().includes(filter.searchQuery.toLowerCase()) ||
      lesson.blurb?.toLowerCase().includes(filter.searchQuery.toLowerCase());

    const matchesSource =
      filter.sourceFilter === 'all' || filter.sourceFilter === 'offline';

    return matchesSearch && matchesSource;
  });
}

function filterBySearchAndSource(
  items: any[],
  filter: SegmentFilterState,
  options: {searchFields: string[]},
): any[] {
  return items.filter(item => {
    const matchesSearch =
      !filter.searchQuery ||
      options.searchFields.some(field =>
        item[field]?.toLowerCase?.().includes(filter.searchQuery.toLowerCase()),
      );

    const matchesSource =
      filter.sourceFilter === 'all' ||
      normalizeSourceType(item.sourceType) === filter.sourceFilter;

    return matchesSearch && matchesSource;
  });
}

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
