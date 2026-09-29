/**
 * Practice-domain quiz question shape for the legacy quick-practice path
 * (`quizEngine` / `useQuiz` / `PracticeScreen` legacy branch,
 * `resolveQuickPractice`, YouTube `practiceMapper`).
 *
 * Moved here from `@shared/schemas/ai-output-v1` (LING-48 / TASK-007) so
 * surviving non-lesson domains no longer depend on the v1 lesson schema
 * scheduled for removal (TASK-010). The shape is intentionally unchanged —
 * do not extend it. New practice work uses `@shared/schemas/practice`.
 */
export type PracticeQuestion = {
  id: string;
  type: 'multiple_choice' | 'translation' | 'fill_blank';
  question: string;
  options?: string[];
  answer: string;
  explanation_vi?: string;
  skill?: 'vocabulary' | 'grammar' | 'translation';
};
