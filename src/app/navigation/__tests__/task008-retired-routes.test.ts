import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const RETIRED_ROUTE_TOKENS = [
  'ContentLessonRuntime',
  'ContentLessonList',
  'ContentLessonDetail',
  'CurriculumLesson',
  'UnifiedLessonGeneration',
  'UnifiedLessonsPreview',
  'YouTubeHistory',
  'YouTubeInput',
  'YouTubeProcessing',
  'YouTubeLesson',
  'PracticeScreen',
  'name="Practice"',
];

describe('TASK-008 retired App routes', () => {
  it('AppNavigator does not register removed lesson/practice/youtube screens', () => {
    const source = readFileSync(
      join(__dirname, '..', 'AppNavigator.tsx'),
      'utf8',
    );
    for (const token of RETIRED_ROUTE_TOKENS) {
      expect(source).not.toContain(token);
    }
    expect(source).toContain('CanonicalLessonPlayer');
    expect(source).toContain('CanonicalCatalog');
  });
});
