/**
 * Minimal structural source for practice eligibility, owned by the practice
 * domain (LING-48 / TASK-007). `LessonV2` from the legacy lesson-v2 schema
 * (removed in TASK-010) satisfies this shape, but eligibility no longer
 * imports that schema.
 */
export type PracticeEligibleLesson = {
  status: string;
  vocabulary: {meaning_vi: string}[];
  sentences: {status: string; translation?: string | null}[];
};

/** D3 minimum validated source thresholds (configurable product policy). */
export const PRACTICE_MIN_VOCABULARY_WITH_MEANING = 4;
export const PRACTICE_MIN_SENTENCES_WITH_TRANSLATION = 1;

export function isTerminalLessonForPractice(
  lesson: PracticeEligibleLesson,
): boolean {
  return (
    lesson.status === 'ready' ||
    lesson.status === 'ready_with_warnings' ||
    lesson.status === 'partially_ready'
  );
}

export function countValidatedSources(lesson: PracticeEligibleLesson): {
  vocabularyWithMeaning: number;
  sentencesWithTranslation: number;
} {
  const vocabularyWithMeaning = lesson.vocabulary.filter(
    item => item.meaning_vi.trim().length > 0,
  ).length;
  const sentencesWithTranslation = lesson.sentences.filter(
    sentence =>
      sentence.status === 'ready' &&
      typeof sentence.translation === 'string' &&
      sentence.translation.trim().length > 0,
  ).length;
  return {vocabularyWithMeaning, sentencesWithTranslation};
}

export function hasMinimumValidatedSource(
  lesson: PracticeEligibleLesson,
): boolean {
  const counts = countValidatedSources(lesson);
  return (
    counts.vocabularyWithMeaning >= PRACTICE_MIN_VOCABULARY_WITH_MEANING ||
    counts.sentencesWithTranslation >= PRACTICE_MIN_SENTENCES_WITH_TRANSLATION
  );
}

export function isLessonEligibleForPractice(
  lesson: PracticeEligibleLesson,
): boolean {
  return (
    isTerminalLessonForPractice(lesson) && hasMinimumValidatedSource(lesson)
  );
}
