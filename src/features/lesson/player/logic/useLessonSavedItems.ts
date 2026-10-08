import {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';

import {
  listBookmarkedGrammar,
  listFlashcards,
  removeFlashcardFromLesson,
  saveFlashcard,
  saveGrammarBookmark,
  unsaveGrammarBookmark,
} from '@features/review';

import {showToast} from '@ui/components/toast';

import {parseItemCode, vocabularyItemKey} from '@core/learning';

import type {LessonPatternEntry} from './lessonHubContent';

/** A word the learner can turn into a flashcard from the lesson. */
export type SavableVocabulary = {
  id: string;
  word: string;
  meaning: string;
  ipa: string | null;
  pos: string | null;
  sourceSentence?: string | null;
};

/** Save state + toggle for the lesson's vocabulary (passed to components). */
export type VocabularySaveControl = {
  /** By item code: a card is one catalog item however the word is written. */
  isSaved: (itemKey: string) => boolean;
  onToggle: (item: SavableVocabulary) => void;
};

/** Save state + toggle for the lesson's sentence patterns (by item code). */
export type PatternSaveControl = {
  isSaved: (itemKey: string) => boolean;
  onToggle: (pattern: LessonPatternEntry) => void;
};

/** Save state + toggle for the lesson's grammar points. */
export type GrammarSaveControl = {
  isSaved: (grammarId: string) => boolean;
  onToggle: (grammarId: string) => void;
};

export type LessonSavedItems = {
  vocabulary: VocabularySaveControl;
  patterns: PatternSaveControl;
  grammar: GrammarSaveControl;
  reload: () => void;
};

/**
 * Flashcard identity of a savable word: the item code it is keyed by (lesson
 * vocabulary), else the code the Server derives from the word (analysis words).
 */
function wordItemKey(item: SavableVocabulary): string | null {
  return parseItemCode(item.id) ? item.id : vocabularyItemKey(item.word);
}

/**
 * Local "Lưu thẻ" / "Đánh dấu" state for one lesson, read from the review
 * repositories so the "Đã lưu" state survives reopening the lesson. Saved
 * words become flashcards (Ôn tập + Thư viện); saved grammar becomes a
 * grammar bookmark (Thư viện). Words and patterns are matched by item code,
 * so the same word saved from the vocabulary list and the sentence analysis
 * is one card.
 */
export function useLessonSavedItems(lessonId: string): LessonSavedItems {
  const {t} = useTranslation();
  // item code -> flashcard id (words, phrases and patterns)
  const [savedCards, setSavedCards] = useState<Record<string, string>>({});
  const [savedGrammar, setSavedGrammar] = useState<Record<string, true>>({});

  const reload = useCallback(() => {
    try {
      const cards: Record<string, string> = {};
      listFlashcards({lessonId}).forEach(card => {
        const key = card.itemKey ?? vocabularyItemKey(card.word);
        if (key) cards[key] = card.id;
      });
      const grammar: Record<string, true> = {};
      listBookmarkedGrammar(lessonId).forEach(bookmark => {
        grammar[bookmark.grammarId] = true;
      });
      setSavedCards(cards);
      setSavedGrammar(grammar);
    } catch {
      // Local DB unavailable: keep the buttons in their unsaved state.
    }
  }, [lessonId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const isCardSaved = useCallback(
    (itemKey: string) => itemKey in savedCards,
    [savedCards],
  );

  /** Removes this lesson's source of a saved card; false when it failed. */
  const unsaveCard = useCallback(
    (key: string): boolean => {
      const flashcardId = savedCards[key];
      if (!flashcardId) return false;
      let ok = false;
      try {
        ok = removeFlashcardFromLesson(flashcardId, lessonId);
      } catch {
        ok = false;
      }
      if (!ok) {
        showToast(t('lessonPlayer.save_error'));
        return false;
      }
      setSavedCards(previous => {
        const next = {...previous};
        delete next[key];
        return next;
      });
      return true;
    },
    [lessonId, savedCards, t],
  );

  const toggleWord = useCallback(
    (item: SavableVocabulary) => {
      const key = wordItemKey(item);
      if (key && savedCards[key]) {
        unsaveCard(key);
        return;
      }
      // Vocabulary list entries are keyed by their item code; analysis words
      // carry an analysis id, and the repository derives their code instead.
      const result = saveFlashcard({
        lessonId,
        vocabulary: {
          id: item.id,
          word: item.word,
          meaningVi: item.meaning,
          ipa: item.ipa,
          wordType: item.pos,
          sourceSentence: item.sourceSentence ?? null,
        },
        item: parseItemCode(item.id) ? {itemKey: item.id} : undefined,
      });
      if (!result.ok || !key) {
        showToast(t('lessonPlayer.save_error'));
        return;
      }
      setSavedCards(previous => ({...previous, [key]: result.flashcardId}));
    },
    [lessonId, savedCards, t, unsaveCard],
  );

  const togglePattern = useCallback(
    (pattern: LessonPatternEntry) => {
      const key = pattern.key;
      if (savedCards[key]) {
        unsaveCard(key);
        return;
      }
      // The card keeps the raw frame; review shows it with its slots blanked
      // and reads the first example aloud.
      const example = pattern.examples[0] ?? null;
      const result = saveFlashcard({
        lessonId,
        vocabulary: {
          id: key,
          word: pattern.frame,
          meaningVi: pattern.meaningVi,
          example: example?.en ?? null,
          exampleTranslation: example?.vi ?? null,
          sourceSentence: null,
        },
        item: {itemKey: key, itemId: pattern.itemId, kind: 'pattern'},
      });
      if (!result.ok) {
        showToast(t('lessonPlayer.save_error'));
        return;
      }
      setSavedCards(previous => ({...previous, [key]: result.flashcardId}));
    },
    [lessonId, savedCards, t, unsaveCard],
  );

  const isGrammarSaved = useCallback(
    (grammarId: string) => savedGrammar[grammarId] === true,
    [savedGrammar],
  );

  const toggleGrammar = useCallback(
    (grammarId: string) => {
      if (savedGrammar[grammarId]) {
        if (!unsaveGrammarBookmark(lessonId, grammarId)) {
          showToast(t('lessonPlayer.save_error'));
          return;
        }
        setSavedGrammar(previous => {
          const next = {...previous};
          delete next[grammarId];
          return next;
        });
        return;
      }
      // Canonical lessons have no content package; the lesson id stands in.
      const result = saveGrammarBookmark({
        lessonId,
        grammarId,
        packageId: lessonId,
      });
      if (!result.ok) {
        showToast(t('lessonPlayer.save_error'));
        return;
      }
      setSavedGrammar(previous => ({...previous, [grammarId]: true}));
    },
    [lessonId, savedGrammar, t],
  );

  return {
    vocabulary: {isSaved: isCardSaved, onToggle: toggleWord},
    patterns: {isSaved: isCardSaved, onToggle: togglePattern},
    grammar: {isSaved: isGrammarSaved, onToggle: toggleGrammar},
    reload,
  };
}
