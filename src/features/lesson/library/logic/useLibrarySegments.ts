import {useFocusEffect} from '@react-navigation/native';
import {useCallback, useMemo, useRef, useState} from 'react';

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

import {activityCountOf, lessonContextLabel} from './lessonCardData';
import {readLibrarySignature} from './librarySignature';

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

/** Which segments a screen reads; unused ones are not loaded at all. */
export interface LibrarySegmentsNeeds {
  lessons?: boolean;
  vocabulary?: boolean;
  grammar?: boolean;
}

const ALL_SEGMENTS: LibrarySegmentsNeeds = {
  lessons: true,
  vocabulary: true,
  grammar: true,
};

/**
 * Calls `refresh` when the screen regains focus, not on the first focus: the
 * data was just loaded on mount, so refreshing then would load it twice.
 */
export function useRefreshOnRefocus(refresh: () => void) {
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      refresh();
    }, [refresh]),
  );
}

export function useLibrarySegments(
  needs: LibrarySegmentsNeeds = ALL_SEGMENTS,
): UseLibrarySegmentsResult {
  const {
    lessons: needsLessons = false,
    vocabulary: needsVocabulary = false,
    grammar: needsGrammar = false,
  } = needs;
  const needsDownloads = needsLessons || needsVocabulary || needsGrammar;
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

  // Fingerprint of the data the loaded segments were read from; a refresh
  // only reloads them when it moved (something saved, downloaded, removed).
  const signatureNeeds = useMemo(
    () => ({vocabulary: needsVocabulary, grammar: needsGrammar}),
    [needsVocabulary, needsGrammar],
  );
  const signature = useMemo(
    () => (needsDownloads ? readLibrarySignature(signatureNeeds) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [needsDownloads, signatureNeeds, refreshVersion],
  );
  const loadedRef = useRef({signature, signatureNeeds});
  loadedRef.current = {signature, signatureNeeds};

  const refresh = useCallback(() => {
    const loaded = loadedRef.current;
    if (loaded.signature === null) return;
    if (readLibrarySignature(loaded.signatureNeeds) === loaded.signature) {
      return;
    }
    setRefreshVersion(v => v + 1);
  }, []);

  const downloads = useMemo(
    () => (needsDownloads ? listDownloadedLessonSummaries() : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [needsDownloads, refreshVersion],
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

  // Building the cards (practice eligibility per lesson) is the costly part;
  // keep it apart from the filter so typing in search only re-filters.
  const lessonCards = useMemo((): LibraryLessonCardView[] => {
    if (!needsLessons) return [];
    return downloads.map(item => ({
      id: item.lessonId,
      title: item.title,
      blurb: item.description,
      dateLabel: item.downloadedAt.slice(0, 10),
      vocabularyCount: item.snapshot.sentences.length,
      durationMin: item.estimatedDurationMinutes,
      sourceType: item.snapshot.source_type,
      origin: item.snapshot.origin,
      practiceReady: isPracticeReady(item.snapshot),
      contextLabel: lessonContextLabel(item.snapshot.unit),
      activityCount: activityCountOf(item.snapshot),
      youtubeDurationMs: item.snapshot.youtube?.duration_ms ?? null,
    }));
  }, [needsLessons, downloads]);

  const packagedLessons = useMemo(
    () =>
      lessonCards.filter(card =>
        matchesSegmentFilter(lessonsFilter, {
          texts: [card.title, card.blurb],
          sourceType: card.sourceType,
        }),
      ),
    [lessonCards, lessonsFilter],
  );

  const vocabulary = useMemo(() => {
    if (!needsVocabulary) return [];
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
  }, [
    needsVocabulary,
    vocabularyFilter,
    downloads,
    sourceByLessonId,
    refreshVersion,
  ]);

  const grammar = useMemo(() => {
    if (!needsGrammar) return [];
    const bookmarks = withGrammarDetails(listAllBookmarkedGrammar(), downloads);
    return bookmarks.filter(bookmark =>
      matchesSegmentFilter(grammarFilter, {
        texts: [bookmark.title, bookmark.content],
        sourceType: sourceByLessonId.get(bookmark.lessonId),
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    needsGrammar,
    grammarFilter,
    downloads,
    sourceByLessonId,
    refreshVersion,
  ]);

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

/** Eligibility is derived from an immutable snapshot, so compute it once. */
const practiceReadyBySnapshot = new WeakMap<object, boolean>();

function isPracticeReady(snapshot: DownloadedLessonSummary['snapshot']) {
  let ready = practiceReadyBySnapshot.get(snapshot);
  if (ready === undefined) {
    ready = getPracticeEligibility(buildPracticeSource(snapshot)).eligible;
    practiceReadyBySnapshot.set(snapshot, ready);
  }
  return ready;
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
