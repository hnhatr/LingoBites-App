import type {LegacyPracticeQuestion as PracticeQuestion} from '@features/practice';

import type {YouTubeSegment} from '@core/schemas/youtube-transcript-v1';

export function mapTranscriptToPractice(
  segments: YouTubeSegment[],
  limit = 10,
): PracticeQuestion[] {
  const validSegments = segments.filter(
    s => s.en.trim() !== '' && s.vi?.trim(),
  );

  // Need at least 2 valid segments to form a multiple choice question with 1 distractor
  if (validSegments.length < 2) {
    return [];
  }

  const practiceSegments = validSegments.slice(0, limit);

  return practiceSegments.map(segment => {
    // Unique distractors excluding the correct answer
    const otherVi = Array.from(
      new Set(
        validSegments
          .filter(s => s.id !== segment.id && s.vi !== segment.vi)
          .map(s => s.vi),
      ),
    );

    // Pick up to 3 random distractors
    const distractors = otherVi.sort(() => 0.5 - Math.random()).slice(0, 3);

    // Combine with correct answer and shuffle
    const options = [segment.vi, ...distractors].sort(
      () => 0.5 - Math.random(),
    );

    return {
      id: segment.id,
      type: 'multiple_choice',
      question: segment.en,
      options,
      answer: segment.vi,
      skill: 'translation',
      explanation_vi: 'Dịch nghĩa từ câu trong video YouTube.',
    };
  });
}
