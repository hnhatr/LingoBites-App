import {showToast} from '@ui/components/toast';

import type {SaveFlashcardInput} from '@core/db/types';
import type {SaveGrammarBookmarkInput} from '@core/db/types';

import {saveFlashcard, unsaveFlashcard} from './FlashcardRepository';
import {
  saveGrammarBookmark,
  unsaveGrammarBookmark,
} from './GrammarBookmarkRepository';

export interface OptimisticStateMap {
  isSaved: Map<string, boolean>;
  getIsSaved: (itemId: string, dbValue: boolean) => boolean;
}

export interface UseBookmarkOptimisticResult {
  vocabularySaveState: OptimisticStateMap;
  grammarSaveState: OptimisticStateMap;
  onVocabularySave: (
    vocabularyId: string,
    input: SaveFlashcardInput,
  ) => Promise<void>;
  onVocabularyUnsave: (vocabularyId: string) => Promise<void>;
  onGrammarSave: (
    grammarId: string,
    input: SaveGrammarBookmarkInput,
  ) => Promise<void>;
  onGrammarUnsave: (grammarId: string, lessonId?: string) => Promise<void>;
}

export function useBookmarkOptimistic(
  defaultLessonId?: string,
): UseBookmarkOptimisticResult {
  // Use plain Map objects for state management (compatible with both React and pure JS)
  const vocabularySavedMap = new Map<string, boolean>();
  const grammarSavedMap = new Map<string, boolean>();

  // Helper to create an OptimisticStateMap
  const createStateMap = (map: Map<string, boolean>): OptimisticStateMap => ({
    isSaved: map,
    getIsSaved: (itemId: string, dbValue: boolean): boolean => {
      const optimistic = map.get(itemId);
      return optimistic !== undefined ? optimistic : dbValue;
    },
  });

  const vocabularySaveState = createStateMap(vocabularySavedMap);
  const grammarSaveState = createStateMap(grammarSavedMap);

  // Vocabulary save with optimistic update
  const onVocabularySave = async (
    vocabularyId: string,
    input: SaveFlashcardInput,
  ): Promise<void> => {
    // Optimistic update: set to true immediately
    vocabularySavedMap.set(vocabularyId, true);

    // Fire the DB operation in the background without awaiting
    try {
      const result = saveFlashcard(input);
      if (!result.ok && result.errorCode === 'LOCAL_DB_ERROR') {
        // Revert optimistic state on error
        vocabularySavedMap.delete(vocabularyId);
        showToast('Lỗi lưu. Vui lòng thử lại.');
      }
    } catch {
      // Revert optimistic state on unexpected error
      vocabularySavedMap.delete(vocabularyId);
      showToast('Lỗi lưu. Vui lòng thử lại.');
    }
  };

  // Vocabulary unsave with optimistic update
  const onVocabularyUnsave = async (vocabularyId: string): Promise<void> => {
    // Store previous state for rollback
    const previousState = vocabularySavedMap.get(vocabularyId);

    // Optimistic update: set to false immediately
    vocabularySavedMap.set(vocabularyId, false);

    // Fire the DB operation in the background without awaiting
    try {
      const result = unsaveFlashcard(vocabularyId);
      if (!result) {
        // Revert optimistic state on error
        if (previousState !== undefined) {
          vocabularySavedMap.set(vocabularyId, previousState);
        } else {
          vocabularySavedMap.delete(vocabularyId);
        }
        showToast('Lỗi bỏ lưu. Vui lòng thử lại.');
      }
    } catch {
      // Revert optimistic state on unexpected error
      if (previousState !== undefined) {
        vocabularySavedMap.set(vocabularyId, previousState);
      } else {
        vocabularySavedMap.delete(vocabularyId);
      }
      showToast('Lỗi bỏ lưu. Vui lòng thử lại.');
    }
  };

  // Grammar save with optimistic update
  const onGrammarSave = async (
    grammarId: string,
    input: SaveGrammarBookmarkInput,
  ): Promise<void> => {
    // Optimistic update: set to true immediately
    grammarSavedMap.set(grammarId, true);

    // Fire the DB operation in the background without awaiting
    try {
      const result = saveGrammarBookmark(input);
      if (!result.ok && result.errorCode === 'LOCAL_DB_ERROR') {
        // Revert optimistic state on error
        grammarSavedMap.delete(grammarId);
        showToast('Lỗi lưu. Vui lòng thử lại.');
      }
    } catch {
      // Revert optimistic state on unexpected error
      grammarSavedMap.delete(grammarId);
      showToast('Lỗi lưu. Vui lòng thử lại.');
    }
  };

  // Grammar unsave with optimistic update
  const onGrammarUnsave = async (
    grammarId: string,
    lessonId?: string,
  ): Promise<void> => {
    // Use provided lessonId or fall back to default
    const resolvedLessonId = lessonId || defaultLessonId;

    if (!resolvedLessonId) {
      // Cannot unsave without a lessonId
      showToast('Lỗi bỏ lưu. Vui lòng thử lại.');
      return;
    }

    // Store previous state for rollback
    const previousState = grammarSavedMap.get(grammarId);

    // Optimistic update: set to false immediately
    grammarSavedMap.set(grammarId, false);

    // Fire the DB operation in the background without awaiting
    try {
      const result = unsaveGrammarBookmark(resolvedLessonId, grammarId);
      if (!result) {
        // Revert optimistic state on error
        if (previousState !== undefined) {
          grammarSavedMap.set(grammarId, previousState);
        } else {
          grammarSavedMap.delete(grammarId);
        }
        showToast('Lỗi bỏ lưu. Vui lòng thử lại.');
      }
    } catch {
      // Revert optimistic state on unexpected error
      if (previousState !== undefined) {
        grammarSavedMap.set(grammarId, previousState);
      } else {
        grammarSavedMap.delete(grammarId);
      }
      showToast('Lỗi bỏ lưu. Vui lòng thử lại.');
    }
  };

  return {
    vocabularySaveState,
    grammarSaveState,
    onVocabularySave,
    onVocabularyUnsave,
    onGrammarSave,
    onGrammarUnsave,
  };
}
