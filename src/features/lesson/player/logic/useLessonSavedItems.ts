import {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';

import {
  listBookmarkedGrammar,
  listFlashcards,
  saveFlashcard,
  saveGrammarBookmark,
  unsaveFlashcard,
  unsaveGrammarBookmark,
} from '@features/review';

import {showToast} from '@ui/components/toast';

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
  isSaved: (word: string) => boolean;
  onToggle: (item: SavableVocabulary) => void;
};

/** Save state + toggle for the lesson's grammar points. */
export type GrammarSaveControl = {
  isSaved: (grammarId: string) => boolean;
  onToggle: (grammarId: string) => void;
};

export type LessonSavedItems = {
  vocabulary: VocabularySaveControl;
  grammar: GrammarSaveControl;
  reload: () => void;
};

function wordKey(word: string): string {
  return word.trim().toLowerCase();
}

/**
 * Local "Lưu thẻ" / "Đánh dấu" state for one lesson, read from the review
 * repositories so the "Đã lưu" state survives reopening the lesson. Saved
 * words become flashcards (Ôn tập + Thư viện); saved grammar becomes a
 * grammar bookmark (Thư viện). Words are matched case-insensitively so the
 * same word saved from the vocabulary list and the sentence analysis is one
 * card.
 */
export function useLessonSavedItems(lessonId: string): LessonSavedItems {
  const {t} = useTranslation();
  // word key -> flashcard id
  const [savedWords, setSavedWords] = useState<Record<string, string>>({});
  const [savedGrammar, setSavedGrammar] = useState<Record<string, true>>({});

  const reload = useCallback(() => {
    try {
      const words: Record<string, string> = {};
      listFlashcards({lessonId}).forEach(card => {
        words[wordKey(card.word)] = card.id;
      });
      const grammar: Record<string, true> = {};
      listBookmarkedGrammar(lessonId).forEach(bookmark => {
        grammar[bookmark.grammarId] = true;
      });
      setSavedWords(words);
      setSavedGrammar(grammar);
    } catch {
      // Local DB unavailable: keep the buttons in their unsaved state.
    }
  }, [lessonId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const isWordSaved = useCallback(
    (word: string) => wordKey(word) in savedWords,
    [savedWords],
  );

  const toggleWord = useCallback(
    (item: SavableVocabulary) => {
      const key = wordKey(item.word);
      const flashcardId = savedWords[key];
      if (flashcardId) {
        let ok = false;
        try {
          ok = unsaveFlashcard(flashcardId);
        } catch {
          ok = false;
        }
        if (!ok) {
          showToast(t('lessonPlayer.save_error'));
          return;
        }
        setSavedWords(previous => {
          const next = {...previous};
          delete next[key];
          return next;
        });
        return;
      }
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
      });
      if (!result.ok) {
        showToast(t('lessonPlayer.save_error'));
        return;
      }
      setSavedWords(previous => ({...previous, [key]: result.flashcardId}));
    },
    [lessonId, savedWords, t],
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
    vocabulary: {isSaved: isWordSaved, onToggle: toggleWord},
    grammar: {isSaved: isGrammarSaved, onToggle: toggleGrammar},
    reload,
  };
}
