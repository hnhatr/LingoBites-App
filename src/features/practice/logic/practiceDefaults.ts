import type {PracticeConfigInput} from '@shared/api/practiceClient';

export const DEFAULT_PRACTICE_QUESTION_COUNT = 10;

export function buildDefaultPracticeConfig(input: {
  level: string;
}): PracticeConfigInput {
  return {
    types: ['meaning_choice', 'cloze_choice'],
    difficulty: input.level || 'beginner',
    question_count: DEFAULT_PRACTICE_QUESTION_COUNT,
  };
}
