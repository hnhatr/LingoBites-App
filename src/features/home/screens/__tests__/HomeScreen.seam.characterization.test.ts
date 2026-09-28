import {readFileSync} from 'fs';
import {join} from 'path';

const inputDir = join(__dirname, '..');

function readModuleSource(filename: string): string {
  return readFileSync(join(inputDir, filename), 'utf8');
}

describe('HomeScreen UI seam (LING-115 TASK-017)', () => {
  const forbiddenInView = [
    '@features/lesson/packages',
    '@features/youtube',
    '@features/engagement',
    '@features/lesson/player',
    'fetchContinueLearning',
    'getGamificationSnapshot',
    'listYouTubeLessons',
    'countYouTubeLessons',
    'listSavedLessons',
    'listStartedLessons',
    'trackEvent',
    'useContentLibrary',
    'useLessonCatalog',
    'useYouTubeServerEnabled',
  ];

  it('HomeScreenView does not import repositories or clients', () => {
    const source = readModuleSource('HomeScreenView.tsx');
    for (const token of forbiddenInView) {
      expect(source).not.toContain(token);
    }
  });

  it('HomeScreen shell delegates orchestration to the controller hook', () => {
    const source = readModuleSource('HomeScreen.tsx');
    expect(source).toContain('useHomeScreenController');
    expect(source).toContain('HomeScreenView');
    expect(source).not.toContain('@features/lesson/packages');
    expect(source).not.toContain('listStartedLessons');
  });
});
