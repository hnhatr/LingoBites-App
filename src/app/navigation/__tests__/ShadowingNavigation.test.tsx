import {readFileSync} from 'node:fs';
import {join} from 'node:path';

describe('Shadowing navigation (TASK-008, root-stack layout)', () => {
  const navigator = readFileSync(
    join(__dirname, '..', 'AppNavigator.tsx'),
    'utf8',
  );
  const rootStack = navigator.slice(
    navigator.indexOf('function AuthenticatedRootStack'),
    navigator.indexOf('export function AppNavigator'),
  );

  it('AC-001: registers the shadowing flow once on the root stack', () => {
    expect(rootStack).toContain('name="ShadowingLessonPicker"');
    expect(rootStack).toContain('ShadowingLessonPickerScreen');
    expect(rootStack).toContain('name="ShadowingSession"');
    expect(rootStack).toContain('name="ShadowingSummary"');
    expect(rootStack).toContain('ShadowingSummaryScreen');
    expect(navigator.split('name="ShadowingLessonPicker"')).toHaveLength(2);
  });

  it('exports Shadowing routes from the root param list', () => {
    const rootTypes = readFileSync(join(__dirname, '..', 'types.ts'), 'utf8');
    expect(rootTypes).toContain('ShadowingLessonPicker:');
    expect(rootTypes).toContain('ShadowingSession:');
    expect(rootTypes).toContain('ShadowingSummary:');
    expect(rootTypes).not.toContain('SpeakingShadowing:');
  });

  it('TASK-007 regression: removes the old SpeakingShadowing activity route', () => {
    expect(navigator).not.toContain('SpeakingShadowingActivity');
  });
});
