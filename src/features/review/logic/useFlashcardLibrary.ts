import {
  getCardDueAt,
  getDueFlashcards,
  listFlashcards,
  recordFlashcardRating,
  saveFlashcard,
  unsaveFlashcard,
} from './FlashcardRepository';

/**
 * Public entry point for flashcard persistence. Screens call this instead of
 * importing `features/review/logic/FlashcardRepository` directly (SETE-118 Việc 3) — the
 * repository stays synchronous under the hood, this only relocates which
 * layer is allowed to know about it.
 *
 * Each member forwards to the repository by name at call time (not captured
 * once into an object) so `jest.spyOn(FlashcardRepository, ...)` in existing
 * tests keeps working through this indirection.
 */
export function useFlashcardLibrary() {
  return flashcardLibrary;
}

const flashcardLibrary = {
  listFlashcards: (...args: Parameters<typeof listFlashcards>) =>
    listFlashcards(...args),
  getDueFlashcards: (...args: Parameters<typeof getDueFlashcards>) =>
    getDueFlashcards(...args),
  saveFlashcard: (...args: Parameters<typeof saveFlashcard>) =>
    saveFlashcard(...args),
  unsaveFlashcard: (...args: Parameters<typeof unsaveFlashcard>) =>
    unsaveFlashcard(...args),
  recordFlashcardRating: (...args: Parameters<typeof recordFlashcardRating>) =>
    recordFlashcardRating(...args),
  getCardDueAt: (...args: Parameters<typeof getCardDueAt>) =>
    getCardDueAt(...args),
};
