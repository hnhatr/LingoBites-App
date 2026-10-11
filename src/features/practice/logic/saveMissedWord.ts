import {saveFlashcard} from '@features/review';

import type {WordLearningItem} from '@core/learning';

/**
 * Saves a word the learner missed in a practice as a flashcard, with the
 * first lesson sentence that carries it as context. True when it was saved.
 */
export function saveMissedWord(
  lessonId: string,
  word: WordLearningItem,
  sentences: ReadonlyArray<{id: string; textEn: string}>,
): boolean {
  const sentence = sentences.find(candidate =>
    word.sentenceIds.includes(candidate.id),
  );
  return saveFlashcard({
    lessonId,
    vocabulary: {
      id: word.itemKey,
      word: word.word,
      meaningVi: word.meaningVi,
      ipa: word.ipa,
      wordType: word.pos,
      sourceSentence: sentence?.textEn ?? null,
    },
    item: {itemKey: word.itemKey, itemId: word.itemId, kind: word.kind},
  }).ok;
}
