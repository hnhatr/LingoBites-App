import {readFileSync} from 'node:fs';
import {join} from 'node:path';

describe('Shadowing session navigation (TASK-007)', () => {
  it('registers ShadowingSession in the Lessons stack and removes the old activity', () => {
    const navigator = readFileSync(
      join(__dirname, '..', 'AppNavigator.tsx'),
      'utf8',
    );
    const lessonsStack = navigator.slice(
      navigator.indexOf('function LessonsStackNavigator'),
      navigator.indexOf('function ProfileStackNavigator'),
    );
    expect(lessonsStack).toContain('name="ShadowingSession"');
    expect(lessonsStack).toContain('ShadowingSessionScreen');
    expect(navigator).not.toContain('SpeakingShadowingActivity');
    expect(lessonsStack).not.toContain('SpeakingShadowing');
  });

  it('exports ShadowingSession route params from lesson library types', () => {
    const types = readFileSync(
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
    expect(types).toContain('ShadowingSession: ShadowingSessionRouteParams');
    expect(types).not.toContain('SpeakingShadowing:');
  });
});
