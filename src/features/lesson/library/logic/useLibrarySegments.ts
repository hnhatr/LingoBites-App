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
import {
  listAllBookmarkedGrammar,
  listFlashcards,
  listFlashcardSources,
} from '@features/review';

import type {FlashcardRecord, GrammarBookmark} from '@core/db/types';
import {buildPracticeSource, getPracticeEligibility} from '@core/learning';
import type {LessonSourceType} from '@core/schemas/lesson';

export interface SegmentFilterState {
  searchQuery: string;
  sourceFilter: LibrarySourceFilter;
}

/** A lesson a saved word came from, with what the library can say about it. */
export interface LibraryVocabularySource {
  lessonId: string;
  /** Title of the downloaded lesson, or null when it is not downloaded. */
  title: string | null;
  sourceType?: LessonSourceType;
}

/** One saved word (a card is shared by every lesson it was saved from). */
export type LibraryVocabularyEntry = FlashcardRecord & {
  sources: LibraryVocabularySource[];
};

export interface UseLibrarySegmentsResult {
  packagedLessons: LibraryLessonCardView[];
  vocabulary: LibraryVocabularyEntry[];
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
      practiceReady: getPracticeEligibility(buildPracticeSource(item.snapshot))
        .eligible,
    }));
    return cards.filter(card =>
      matchesSegmentFilter(lessonsFilter, {
        texts: [card.title, card.blurb],
        sourceType: card.sourceType,
      }),
    );
  }, [downloads, lessonsFilter]);

  const vocabulary = useMemo(() => {
    const sourcesByCard = listFlashcardSources();
    const titleByLessonId = new Map(
      downloads.map(item => [item.lessonId, item.title] as const),
    );
    const cards = listFlashcards({includeUnsaved: false}).map(
      (card): LibraryVocabularyEntry => {
        // A card saved before schema v5, or with no usable key, has no source
        // rows: its own lesson is its only source.
        const lessonIds = (sourcesByCard.get(card.id) ?? []).map(
          source => source.lessonId,
        );
        const sources = (
          lessonIds.length > 0 ? lessonIds : [card.lessonId]
        ).map(
          (lessonId): LibraryVocabularySource => ({
            lessonId,
            title: titleByLessonId.get(lessonId) ?? null,
            sourceType: sourceByLessonId.get(lessonId),
          }),
        );
        return {...card, sources};
      },
    );
    return cards.filter(card =>
      // A word shared by several lessons matches a source filter through any
      // of them.
      card.sources.some(source =>
        matchesSegmentFilter(vocabularyFilter, {
          texts: [card.word, card.meaningVi, card.example],
          sourceType: source.sourceType,
        }),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocabularyFilter, downloads, sourceByLessonId, refreshVersion]);

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
