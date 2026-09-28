import type {PracticeQuestion} from './practiceQuestion';

type LessonListItem = {id: string; title: string};

type LessonRecord = {
  title: string;
  aiOutput: {practice?: PracticeQuestion[]};
};

/**
 * Picks practice questions from the newest personal lesson that actually
 * ships practice items. Matches HomeScreen / Library quick-practice entry.
 */
export function resolveQuickPractice(
  lessons: LessonListItem[],
  getLessonById: (id: string) => LessonRecord | null | undefined,
): {questions: PracticeQuestion[]; title: string} {
  for (const item of lessons) {
    const record = getLessonById(item.id);
    const questions = record?.aiOutput.practice ?? [];
    if (questions.length > 0) {
      return {questions, title: record?.title ?? item.title};
    }
  }
  return {questions: [], title: ''};
}
