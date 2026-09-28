import {
  countValidatedSources,
  hasMinimumValidatedSource,
  isLessonEligibleForPractice,
  isTerminalLessonForPractice,
  type PracticeEligibleLesson,
} from '../practiceEligibility';

function baseLesson(
  overrides: Partial<PracticeEligibleLesson> = {},
): PracticeEligibleLesson {
  return {
    status: 'ready',
    sentences: [],
    vocabulary: [],
    ...overrides,
  };
}

describe('practiceEligibility', () => {
  it('requires terminal lesson status and minimum validated source', () => {
    const eligible = baseLesson({
      vocabulary: Array.from({length: 4}, (_, index) => ({
        meaning_vi: `nghĩa ${index}`,
      })),
    });
    expect(isTerminalLessonForPractice(eligible)).toBe(true);
    expect(hasMinimumValidatedSource(eligible)).toBe(true);
    expect(isLessonEligibleForPractice(eligible)).toBe(true);
  });

  it('accepts partially_ready lessons with enough source', () => {
    const lesson = baseLesson({
      status: 'partially_ready',
      sentences: [
        {
          status: 'ready',
          translation: 'Xin chào',
        },
      ],
    });
    expect(countValidatedSources(lesson).sentencesWithTranslation).toBe(1);
    expect(isLessonEligibleForPractice(lesson)).toBe(true);
  });

  it('rejects non-terminal lessons even with enough source', () => {
    const lesson = baseLesson({
      status: 'skeleton_ready',
      vocabulary: Array.from({length: 4}, (_, index) => ({
        meaning_vi: `nghĩa ${index}`,
      })),
    });
    expect(isLessonEligibleForPractice(lesson)).toBe(false);
  });
});
