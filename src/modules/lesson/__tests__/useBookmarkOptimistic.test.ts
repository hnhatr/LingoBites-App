import {
  saveFlashcard,
  unsaveFlashcard,
} from '@modules/review/FlashcardRepository';
import {
  saveGrammarBookmark,
  unsaveGrammarBookmark,
} from '@modules/review/GrammarBookmarkRepository';
import {useBookmarkOptimistic} from '@modules/review';

// Mock the repositories
jest.mock('@modules/review/FlashcardRepository', () => ({
  saveFlashcard: jest.fn(),
  unsaveFlashcard: jest.fn(),
}));
jest.mock('@modules/review/GrammarBookmarkRepository', () => ({
  saveGrammarBookmark: jest.fn(),
  unsaveGrammarBookmark: jest.fn(),
}));

// Mock the toast utility
jest.mock('@/utils/toast', () => ({
  showToast: jest.fn(),
}));

import {showToast} from '@/utils/toast';

// Helper to test hooks without React runtime
function testHook(fn: () => any): any {
  return fn();
}

describe('useBookmarkOptimistic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('OptimisticStateMap', () => {
    it('should provide getIsSaved function', () => {
      const hook = testHook(() => useBookmarkOptimistic());

      expect(hook).toBeDefined();
      expect(hook.vocabularySaveState).toBeDefined();
      expect(typeof hook.vocabularySaveState.getIsSaved).toBe('function');
    });

    it('should provide getIsSaved that returns optimistic value when present', () => {
      const hook = testHook(() => useBookmarkOptimistic());

      // Set an optimistic value
      hook.vocabularySaveState.isSaved.set('item-1', true);

      // getIsSaved should return the optimistic value
      expect(hook.vocabularySaveState.getIsSaved('item-1', false)).toBe(true);
    });

    it('should provide getIsSaved that returns db value when optimistic state is not set', () => {
      const hook = testHook(() => useBookmarkOptimistic());

      const isSaved = hook.vocabularySaveState.getIsSaved('item-1', true);
      expect(isSaved).toBe(true);
    });

    it('should have isSaved Map property', () => {
      const hook = testHook(() => useBookmarkOptimistic());

      expect(hook.vocabularySaveState.isSaved).toBeInstanceOf(Map);
    });
  });

  describe('onVocabularySave', () => {
    it('should update optimistic state immediately', async () => {
      const hook = testHook(() => useBookmarkOptimistic());

      (saveFlashcard as jest.Mock).mockReturnValue({
        ok: true,
        flashcardId: 'fc-1',
      });

      const input = {
        lessonId: 'lesson-1',
        vocabulary: {
          id: 'vocab-1',
          word: 'hello',
          meaning_vi: 'xin chào',
        },
      };

      await hook.onVocabularySave('vocab-1', input);

      // Optimistic state should be updated to true
      expect(hook.vocabularySaveState.getIsSaved('vocab-1', false)).toBe(true);
    });

    it('should call saveFlashcard without waiting', async () => {
      const hook = testHook(() => useBookmarkOptimistic());

      (saveFlashcard as jest.Mock).mockReturnValue({
        ok: true,
        flashcardId: 'fc-1',
      });

      const input = {
        lessonId: 'lesson-1',
        vocabulary: {
          id: 'vocab-1',
          word: 'hello',
          meaning_vi: 'xin chào',
        },
      };

      await hook.onVocabularySave('vocab-1', input);

      expect(saveFlashcard).toHaveBeenCalledWith(input);
    });

    it('should revert optimistic state on LOCAL_DB_ERROR', async () => {
      const hook = testHook(() => useBookmarkOptimistic());

      (saveFlashcard as jest.Mock).mockReturnValue({
        ok: false,
        errorCode: 'LOCAL_DB_ERROR',
      });

      const input = {
        lessonId: 'lesson-1',
        vocabulary: {
          id: 'vocab-1',
          word: 'hello',
          meaning_vi: 'xin chào',
        },
      };

      await hook.onVocabularySave('vocab-1', input);

      // After error, should revert to false
      expect(hook.vocabularySaveState.getIsSaved('vocab-1', false)).toBe(false);
    });

    it('should show error toast on LOCAL_DB_ERROR', async () => {
      const hook = testHook(() => useBookmarkOptimistic());

      (saveFlashcard as jest.Mock).mockReturnValue({
        ok: false,
        errorCode: 'LOCAL_DB_ERROR',
      });

      const input = {
        lessonId: 'lesson-1',
        vocabulary: {
          id: 'vocab-1',
          word: 'hello',
          meaning_vi: 'xin chào',
        },
      };

      await hook.onVocabularySave('vocab-1', input);

      expect(showToast).toHaveBeenCalledWith('Lỗi lưu. Vui lòng thử lại.');
    });
  });

  describe('onVocabularyUnsave', () => {
    it('should update optimistic state to false immediately', async () => {
      const hook = testHook(() => useBookmarkOptimistic());

      (unsaveFlashcard as jest.Mock).mockReturnValue(true);

      // First set optimistic state to true
      hook.vocabularySaveState.isSaved.set('vocab-1', true);

      expect(hook.vocabularySaveState.getIsSaved('vocab-1', true)).toBe(true);

      await hook.onVocabularyUnsave('vocab-1');

      // Should be false after unsave
      expect(hook.vocabularySaveState.getIsSaved('vocab-1', true)).toBe(false);
    });

    it('should call unsaveFlashcard', async () => {
      const hook = testHook(() => useBookmarkOptimistic());

      (unsaveFlashcard as jest.Mock).mockReturnValue(true);

      await hook.onVocabularyUnsave('vocab-1');

      expect(unsaveFlashcard).toHaveBeenCalledWith('vocab-1');
    });

    it('should revert optimistic state on error', async () => {
      const hook = testHook(() => useBookmarkOptimistic());

      (unsaveFlashcard as jest.Mock).mockReturnValue(false);

      // Set optimistic state to true first
      hook.vocabularySaveState.isSaved.set('vocab-1', true);

      await hook.onVocabularyUnsave('vocab-1');

      // After error, should revert to true
      expect(hook.vocabularySaveState.getIsSaved('vocab-1', true)).toBe(true);
    });

    it('should show error toast on unsave error', async () => {
      const hook = testHook(() => useBookmarkOptimistic());

      (unsaveFlashcard as jest.Mock).mockReturnValue(false);

      await hook.onVocabularyUnsave('vocab-1');

      expect(showToast).toHaveBeenCalledWith('Lỗi bỏ lưu. Vui lòng thử lại.');
    });
  });

  describe('onGrammarSave', () => {
    it('should update optimistic state immediately', async () => {
      const hook = testHook(() => useBookmarkOptimistic());

      (saveGrammarBookmark as jest.Mock).mockReturnValue({ok: true});

      const input = {
        lessonId: 'lesson-1',
        grammarId: 'gram-1',
        packageId: 'pkg-1',
      };

      await hook.onGrammarSave('gram-1', input);

      // Optimistic state should be updated to true
      expect(hook.grammarSaveState.getIsSaved('gram-1', false)).toBe(true);
    });

    it('should call saveGrammarBookmark without waiting', async () => {
      const hook = testHook(() => useBookmarkOptimistic());

      (saveGrammarBookmark as jest.Mock).mockReturnValue({ok: true});

      const input = {
        lessonId: 'lesson-1',
        grammarId: 'gram-1',
        packageId: 'pkg-1',
      };

      await hook.onGrammarSave('gram-1', input);

      expect(saveGrammarBookmark).toHaveBeenCalledWith(input);
    });

    it('should revert optimistic state on LOCAL_DB_ERROR', async () => {
      const hook = testHook(() => useBookmarkOptimistic());

      (saveGrammarBookmark as jest.Mock).mockReturnValue({
        ok: false,
        errorCode: 'LOCAL_DB_ERROR',
      });

      const input = {
        lessonId: 'lesson-1',
        grammarId: 'gram-1',
        packageId: 'pkg-1',
      };

      await hook.onGrammarSave('gram-1', input);

      // After error, should revert to false
      expect(hook.grammarSaveState.getIsSaved('gram-1', false)).toBe(false);
    });

    it('should show error toast on LOCAL_DB_ERROR', async () => {
      const hook = testHook(() => useBookmarkOptimistic());

      (saveGrammarBookmark as jest.Mock).mockReturnValue({
        ok: false,
        errorCode: 'LOCAL_DB_ERROR',
      });

      const input = {
        lessonId: 'lesson-1',
        grammarId: 'gram-1',
        packageId: 'pkg-1',
      };

      await hook.onGrammarSave('gram-1', input);

      expect(showToast).toHaveBeenCalledWith('Lỗi lưu. Vui lòng thử lại.');
    });
  });

  describe('onGrammarUnsave', () => {
    it('should update optimistic state to false immediately', async () => {
      const hook = testHook(() => useBookmarkOptimistic('lesson-1'));

      (unsaveGrammarBookmark as jest.Mock).mockReturnValue(true);

      // First set optimistic state to true
      hook.grammarSaveState.isSaved.set('gram-1', true);

      expect(hook.grammarSaveState.getIsSaved('gram-1', true)).toBe(true);

      await hook.onGrammarUnsave('gram-1');

      // Should be false after unsave
      expect(hook.grammarSaveState.getIsSaved('gram-1', true)).toBe(false);
    });

    it('should call unsaveGrammarBookmark with correct parameters', async () => {
      const hook = testHook(() => useBookmarkOptimistic('lesson-1'));

      (unsaveGrammarBookmark as jest.Mock).mockReturnValue(true);

      await hook.onGrammarUnsave('gram-1');

      expect(unsaveGrammarBookmark).toHaveBeenCalledWith('lesson-1', 'gram-1');
    });

    it('should accept lessonId as parameter to onGrammarUnsave', async () => {
      const hook = testHook(() => useBookmarkOptimistic());

      (unsaveGrammarBookmark as jest.Mock).mockReturnValue(true);

      await hook.onGrammarUnsave('gram-1', 'lesson-2');

      expect(unsaveGrammarBookmark).toHaveBeenCalledWith('lesson-2', 'gram-1');
    });

    it('should revert optimistic state on error', async () => {
      const hook = testHook(() => useBookmarkOptimistic('lesson-1'));

      (unsaveGrammarBookmark as jest.Mock).mockReturnValue(false);

      // Set optimistic state to true first
      hook.grammarSaveState.isSaved.set('gram-1', true);

      await hook.onGrammarUnsave('gram-1');

      // After error, should revert to true
      expect(hook.grammarSaveState.getIsSaved('gram-1', true)).toBe(true);
    });

    it('should show error toast on unsave error', async () => {
      const hook = testHook(() => useBookmarkOptimistic('lesson-1'));

      (unsaveGrammarBookmark as jest.Mock).mockReturnValue(false);

      await hook.onGrammarUnsave('gram-1');

      expect(showToast).toHaveBeenCalledWith('Lỗi bỏ lưu. Vui lòng thử lại.');
    });
  });

  describe('separate state maps', () => {
    it('should maintain independent vocabulary and grammar save states', async () => {
      const hook = testHook(() => useBookmarkOptimistic('lesson-1'));

      (saveFlashcard as jest.Mock).mockReturnValue({
        ok: true,
        flashcardId: 'fc-1',
      });
      (saveGrammarBookmark as jest.Mock).mockReturnValue({ok: true});

      await hook.onVocabularySave('vocab-1', {
        lessonId: 'lesson-1',
        vocabulary: {id: 'vocab-1', word: 'hello', meaning_vi: 'xin chào'},
      });

      await hook.onGrammarSave('gram-1', {
        lessonId: 'lesson-1',
        grammarId: 'gram-1',
        packageId: 'pkg-1',
      });

      expect(hook.vocabularySaveState.getIsSaved('vocab-1', false)).toBe(true);
      expect(hook.grammarSaveState.getIsSaved('gram-1', false)).toBe(true);
    });
  });
});
