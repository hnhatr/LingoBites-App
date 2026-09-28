import {
  saveFlashcard,
  unsaveFlashcard,
} from '@modules/review/FlashcardRepository';
import {
  saveGrammarBookmark,
  unsaveGrammarBookmark,
} from '@modules/review/GrammarBookmarkRepository';
import {useBookmarkOptimistic} from '../useBookmarkOptimistic';

jest.mock('@modules/review/FlashcardRepository', () => ({
  saveFlashcard: jest.fn(),
  unsaveFlashcard: jest.fn(),
  listFlashcards: jest.fn(() => []),
}));

jest.mock('@modules/review/GrammarBookmarkRepository', () => ({
  saveGrammarBookmark: jest.fn(),
  unsaveGrammarBookmark: jest.fn(),
  listAllBookmarkedGrammar: jest.fn(() => []),
}));

jest.mock('@/utils/toast', () => ({
  showToast: jest.fn(),
}));

import {showToast} from '@/utils/toast';

function testHook(fn: () => ReturnType<typeof useBookmarkOptimistic>) {
  return fn();
}

describe('Library Segments Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should save vocabulary with optimistic state update', async () => {
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

    await hook.onVocabularySave('fc-1', input);

    expect(hook.vocabularySaveState.getIsSaved('fc-1', false)).toBe(true);
    expect(saveFlashcard).toHaveBeenCalledWith(input);
  });

  it('should handle DB error on vocabulary save with graceful recovery', async () => {
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

    await hook.onVocabularySave('fc-1', input);

    expect(hook.vocabularySaveState.getIsSaved('fc-1', false)).toBe(false);
    expect(showToast).toHaveBeenCalledWith('Lỗi lưu. Vui lòng thử lại.');
  });

  it('should save grammar bookmark with optimistic state update', async () => {
    const hook = testHook(() => useBookmarkOptimistic());

    (saveGrammarBookmark as jest.Mock).mockReturnValue({
      ok: true,
      duplicate: false,
    });

    await hook.onGrammarSave('grammar-1', {
      lessonId: 'lesson-1',
      grammarId: 'grammar-1',
      packageId: 'pkg-1',
    });

    expect(hook.grammarSaveState.getIsSaved('grammar-1', false)).toBe(true);
    expect(saveGrammarBookmark).toHaveBeenCalled();
  });

  it('should handle DB error on grammar unsave with graceful recovery', async () => {
    const hook = testHook(() => useBookmarkOptimistic());

    (unsaveGrammarBookmark as jest.Mock).mockReturnValue(false);

    await hook.onGrammarUnsave('grammar-1', 'lesson-1');

    expect(showToast).toHaveBeenCalledWith('Lỗi bỏ lưu. Vui lòng thử lại.');
  });

  it('should remain idempotent on repeated vocabulary unsave calls', async () => {
    const hook = testHook(() => useBookmarkOptimistic());

    (unsaveFlashcard as jest.Mock).mockReturnValue(true);

    await hook.onVocabularyUnsave('fc-1');
    await hook.onVocabularyUnsave('fc-1');

    expect(unsaveFlashcard).toHaveBeenCalledTimes(2);
    expect(hook.vocabularySaveState.getIsSaved('fc-1', true)).toBe(false);
  });
});
