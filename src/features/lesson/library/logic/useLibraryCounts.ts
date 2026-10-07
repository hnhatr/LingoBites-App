import {useCallback, useRef, useState} from 'react';

import {
  getLessonDownloadsSignature,
  listLessonDownloadKinds,
} from '@features/lesson/player';
import {
  getBookmarkedGrammarSignature,
  getSavedFlashcardsSignature,
} from '@features/review';

import type {LessonOrigin, LessonSourceType} from '@core/schemas/lesson';

import {
  isOwnLessonSection,
  lessonBelongsToSection,
  LIBRARY_SECTIONS,
  type LibrarySectionId,
} from './librarySections';

export type LibraryCounts = Record<LibrarySectionId, number>;

interface CountsState {
  counts: LibraryCounts;
  downloadsSignature: string;
  vocabularySignature: string;
  grammarSignature: string;
}

/**
 * Item counts for the Library hub cards. Only counts are read (in SQLite),
 * never the lesson bodies, words or grammar themselves: each section list
 * loads its own items when opened.
 */
export function useLibraryCounts(): {
  counts: LibraryCounts;
  refresh: () => void;
} {
  const [state, setState] = useState<CountsState>(() => loadCounts(null));
  const stateRef = useRef(state);
  stateRef.current = state;

  // Re-reads only the signatures; nothing changes when nothing moved.
  const refresh = useCallback(() => {
    const next = loadCounts(stateRef.current);
    if (next !== stateRef.current) setState(next);
  }, []);

  return {counts: state.counts, refresh};
}

function loadCounts(previous: CountsState | null): CountsState {
  const downloadsSignature = getLessonDownloadsSignature();
  const vocabulary = getSavedFlashcardsSignature();
  const grammar = getBookmarkedGrammarSignature();
  if (
    previous &&
    previous.downloadsSignature === downloadsSignature &&
    previous.vocabularySignature === vocabulary.signature &&
    previous.grammarSignature === grammar.signature
  ) {
    return previous;
  }

  const kinds =
    previous && previous.downloadsSignature === downloadsSignature
      ? null
      : listLessonDownloadKinds();
  const counts = {} as LibraryCounts;
  LIBRARY_SECTIONS.forEach(section => {
    if (isOwnLessonSection(section)) {
      counts[section.id] = kinds
        ? kinds.filter(
            kind =>
              kind.origin !== null &&
              kind.sourceType !== null &&
              lessonBelongsToSection(section, {
                origin: kind.origin as LessonOrigin,
                sourceType: kind.sourceType as LessonSourceType,
              }),
          ).length
        : previous!.counts[section.id];
    } else if (section.id === 'vocabulary') {
      counts[section.id] = vocabulary.count;
    } else if (section.id === 'grammar') {
      counts[section.id] = grammar.count;
    } else {
      // Public sections live on the server: no local count.
      counts[section.id] = 0;
    }
  });
  return {
    counts,
    downloadsSignature,
    vocabularySignature: vocabulary.signature,
    grammarSignature: grammar.signature,
  };
}
