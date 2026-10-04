import {readFileSync} from 'node:fs';
import {join} from 'node:path';

describe('Shadowing navigation (TASK-008)', () => {
  const navigator = readFileSync(
    join(__dirname, '..', 'AppNavigator.tsx'),
    'utf8',
  );
  const homeStack = navigator.slice(
    navigator.indexOf('function HomeStackNavigator'),
    navigator.indexOf('function CreateStackNavigator'),
  );
  const lessonsStack = navigator.slice(
    navigator.indexOf('function LessonsStackNavigator'),
    navigator.indexOf('function ProfileStackNavigator'),
  );

  it('AC-001 S1: registers ShadowingLessonPicker in the Home stack', () => {
    expect(homeStack).toContain('name="ShadowingLessonPicker"');
    expect(homeStack).toContain('ShadowingLessonPickerScreen');
    expect(homeStack).toContain('name="ShadowingSession"');
    expect(homeStack).toContain('name="ShadowingSummary"');
    expect(homeStack).toContain('ShadowingSummaryScreen');
  });

  it('AC-001 S2: registers ShadowingLessonPicker in the Lessons stack', () => {
    expect(lessonsStack).toContain('name="ShadowingLessonPicker"');
    expect(lessonsStack).toContain('name="ShadowingSession"');
    expect(lessonsStack).toContain('name="ShadowingSummary"');
    expect(lessonsStack).not.toContain('SpeakingShadowing');
  });

  it('exports Shadowing routes from home and library navigation types', () => {
    const homeTypes = readFileSync(
      join(
        __dirname,
        '..',
        '..',
        '..',
        'features',
        'home',
        'screens',
        'navigationTypes.ts',
      ),
      'utf8',
    );
    const lessonsTypes = readFileSync(
      join(
        __dirname,
        '..',
        '..',
        '..',
        'features',
        'lesson',
        'library',
        'screens',
        'navigationTypes.ts',
      ),
      'utf8',
    );
    expect(homeTypes).toContain('ShadowingLessonPicker');
    expect(homeTypes).toContain('ShadowingSession');
    expect(homeTypes).toContain('ShadowingSummary');
    expect(lessonsTypes).toContain('ShadowingLessonPicker:');
    expect(lessonsTypes).toContain('ShadowingSummary:');
    expect(lessonsTypes).not.toContain('SpeakingShadowing:');
  });

  it('TASK-007 regression: removes the old SpeakingShadowing activity route', () => {
    expect(navigator).not.toContain('SpeakingShadowingActivity');
  });
});
