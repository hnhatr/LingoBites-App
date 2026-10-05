import {useCallback, useMemo, useState} from 'react';

import type {
  LibraryLessonCardView,
  LibrarySourceFilter,
} from '@features/lesson/library/logic/lesson';
import {
  collectLessonGrammar,
  type DownloadedLessonSummary,
  listDownloadedLessonSummaries,
} from '@features/lesson/player';
import {listAllBookmarkedGrammar, listFlashcards} from '@features/review';

import type {FlashcardRecord, GrammarBookmark} from '@core/db/types';
import type {LessonSourceType} from '@core/schemas/lesson';

export interface SegmentFilterState {
  searchQuery: string;
  sourceFilter: LibrarySourceFilter;
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

  const downloads = useMemo(
    () => listDownloadedLessonSummaries(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshVersion],
  );

  // Saved words/grammar only keep a lessonId; their source is the source of
  // the downloaded lesson they were saved from.
  const sourceByLessonId = useMemo(
    () =>
      new Map<string, LessonSourceType>(
        downloads.map(item => [item.lessonId, item.snapshot.source_type]),
      ),
    [downloads],
  );

  const packagedLessons = useMemo(() => {
    const cards: LibraryLessonCardView[] = downloads.map(item => ({
      id: item.lessonId,
      title: item.title,
      blurb: item.description,
      dateLabel: item.downloadedAt.slice(0, 10),
      vocabularyCount: item.snapshot.sentences.length,
      durationMin: item.estimatedDurationMinutes,
      sourceType: item.snapshot.source_type,
    }));
    return cards.filter(card =>
      matchesSegmentFilter(lessonsFilter, {
        texts: [card.title, card.blurb],
        sourceType: card.sourceType,
      }),
    );
  }, [downloads, lessonsFilter]);

  const vocabulary = useMemo(() => {
    const cards = listFlashcards({includeUnsaved: false});
    return cards.filter(card =>
      matchesSegmentFilter(vocabularyFilter, {
        texts: [card.word, card.meaningVi, card.example],
        sourceType: sourceByLessonId.get(card.lessonId),
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocabularyFilter, sourceByLessonId, refreshVersion]);

  const grammar = useMemo(() => {
    const bookmarks = withGrammarDetails(listAllBookmarkedGrammar(), downloads);
    return bookmarks.filter(bookmark =>
      matchesSegmentFilter(grammarFilter, {
        texts: [bookmark.title, bookmark.content],
        sourceType: sourceByLessonId.get(bookmark.lessonId),
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grammarFilter, downloads, sourceByLessonId, refreshVersion]);

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

/**
 * Bookmarks only store ids; the title/summary come from the downloaded
 * lesson the point was saved from. Points that cannot be resolved (lesson
 * removed, or grammar from an analysis fetched after download) keep no title.
 */
function withGrammarDetails(
  bookmarks: GrammarBookmark[],
  downloads: DownloadedLessonSummary[],
): (GrammarBookmark & {title?: string; content?: string})[] {
  if (bookmarks.length === 0) return bookmarks;
  const details = new Map<string, {title: string; content: string}>();
  downloads.forEach(lesson => {
    collectLessonGrammar(lesson.snapshot, lesson.snapshot.analyses).forEach(
      entry => {
        details.set(`${lesson.lessonId}:${entry.key}`, {
          title: entry.name,
          content: entry.formula ?? entry.nameVi ?? entry.explanation ?? '',
        });
      },
    );
  });
  return bookmarks.map(bookmark => ({
    ...bookmark,
    ...details.get(`${bookmark.lessonId}:${bookmark.grammarId}`),
  }));
}

/**
 * Search matches any of `texts` (case-insensitive); the source filter matches
 * the item's real lesson `source_type`. Items whose source is unknown only
 * show under "Tất cả".
 */
export function matchesSegmentFilter(
  filter: SegmentFilterState,
  item: {
    texts: (string | null | undefined)[];
    sourceType: LessonSourceType | undefined;
  },
): boolean {
  const query = filter.searchQuery.trim().toLowerCase();
  const matchesSearch =
    !query || item.texts.some(text => text?.toLowerCase().includes(query));
  const matchesSource =
    filter.sourceFilter === 'all' || item.sourceType === filter.sourceFilter;
  return matchesSearch && matchesSource;
}

export function isSegmentFilterActive(filter: SegmentFilterState): boolean {
  return filter.searchQuery.trim() !== '' || filter.sourceFilter !== 'all';
}
