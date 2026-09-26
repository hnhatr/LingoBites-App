import {
  IMMERSIVE_STACK_ROUTES,
  isTabBarHiddenForDescriptors,
  shouldHideTabBarForRouteName,
} from '../immersiveTabRoutes';

describe('immersiveTabRoutes', () => {
  it('hides the tab bar on immersive lesson and YouTube processing routes', () => {
    for (const name of [
      'ContentLessonRuntime',
      'YouTubeProcessing',
      'YouTubeLesson',
      'YouTubeInput',
    ]) {
      expect(shouldHideTabBarForRouteName(name)).toBe(true);
    }
  });

  it('hides the tab bar on focused sessions (SETE-255)', () => {
    for (const name of [
      'DailyReview',
      'ContentLessonRuntime',
      'SpeakingRoom',
      'SpeakingShadowing',
    ]) {
      expect(shouldHideTabBarForRouteName(name)).toBe(true);
    }
  });

  it('keeps the tab bar on primary feed routes', () => {
    expect(shouldHideTabBarForRouteName('HomeMain')).toBe(false);
    expect(shouldHideTabBarForRouteName('LessonsList')).toBe(false);
    expect(shouldHideTabBarForRouteName(undefined)).toBe(false);
  });

  it('documents every immersive route in the set', () => {
    expect(IMMERSIVE_STACK_ROUTES.size).toBeGreaterThanOrEqual(4);
  });

  describe('isTabBarHiddenForDescriptors', () => {
    const state = {
      index: 1,
      routes: [{key: 'home'}, {key: 'lessons'}],
    };

    it('returns true when the focused tab hides the bar', () => {
      expect(
        isTabBarHiddenForDescriptors(state, {
          home: {options: {tabBarStyle: {display: 'flex'}}},
          lessons: {options: {tabBarStyle: {display: 'none'}}},
        }),
      ).toBe(true);
    });

    it('returns false when the focused tab keeps the bar', () => {
      expect(
        isTabBarHiddenForDescriptors(state, {
          home: {options: {tabBarStyle: {display: 'none'}}},
          lessons: {options: {tabBarStyle: {display: 'flex'}}},
        }),
      ).toBe(false);
    });

    it('returns false when no style is set', () => {
      expect(isTabBarHiddenForDescriptors(state, {})).toBe(false);
    });
  });
});
