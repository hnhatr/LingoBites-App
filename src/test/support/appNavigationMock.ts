import type {AppNavigation} from '@core/navigation';

/**
 * Shared jest double for `useAppNavigation()`.
 *
 * `jest.setup.js` makes `useAppNavigation()` return this object whenever a
 * test renders without an `<AppNavigationProvider>`, mirroring how the setup
 * already stubs `useNavigation()`. Assert on it directly:
 *
 *   expect(mockAppNavigation.openLesson).toHaveBeenCalledWith('lesson-1');
 *
 * `jest.clearAllMocks()` resets the call history.
 */
export const mockAppNavigation: jest.Mocked<AppNavigation> = {
  openLesson: jest.fn(),
  openLessonFlow: jest.fn(),
  openCatalog: jest.fn(),
  openLibrarySection: jest.fn(),
  openVideoHub: jest.fn(),
  openCourse: jest.fn(),
  openCreate: jest.fn(),
  startCreate: jest.fn(),
  finishCreate: jest.fn(),
  openReview: jest.fn(),
  openItemReview: jest.fn(),
  openPractice: jest.fn(),
  openToday: jest.fn(),
  openSpeakingRoom: jest.fn(),
  openLearningProfile: jest.fn(),
  openShadowing: jest.fn(),
  goToTab: jest.fn(),
  goBack: jest.fn(),
};
