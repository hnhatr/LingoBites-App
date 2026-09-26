import {getRootStackRouteNames} from '../rootStackRoutes';

describe('RootStack route registration (SETE-289)', () => {
  it('registers YouTubeHistory above the tabs while the flag is on (AC-1)', () => {
    const names = getRootStackRouteNames({youtubeLearning: true});

    expect(names[0]).toBe('Tabs');
    expect(names).toContain('YouTubeHistory');
    // The lesson/detail screens History opens stay above the tabs too, so
    // opening a saved lesson never switches the active tab (AC-8).
    expect(names).toEqual(
      expect.arrayContaining([
        'YouTubeLesson',
        'Practice',
      ]),
    );
    // Only History moves up: the create flow stays in the Create tab.
    expect(names).not.toContain('YouTubeInput');
    expect(names).not.toContain('CreateMain');
  });

  it('mounts no YouTube routes at the root while the flag is off (AC-11)', () => {
    expect(getRootStackRouteNames({youtubeLearning: false})).toEqual(['Tabs']);
    expect(getRootStackRouteNames({})).toEqual(['Tabs']);
  });
});
