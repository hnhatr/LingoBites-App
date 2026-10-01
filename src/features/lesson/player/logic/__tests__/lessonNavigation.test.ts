import {openLesson, openLessonCatalog} from '../lessonNavigation';

describe('lessonNavigation helpers (LING-179 TASK-001)', () => {
  it('openLesson opens CanonicalLessonPlayer with the same lessonId', () => {
    const navigation = {navigate: jest.fn()};
    openLesson(navigation, 'lesson-1');
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledWith('CanonicalLessonPlayer', {
      lessonId: 'lesson-1',
    });
  });

  it('openLesson passes through whatever lessonId it receives', () => {
    const navigation = {navigate: jest.fn()};
    openLesson(navigation, '00000000-0000-4000-8000-000000000042');
    expect(navigation.navigate).toHaveBeenCalledWith('CanonicalLessonPlayer', {
      lessonId: '00000000-0000-4000-8000-000000000042',
    });
  });

  it('openLessonCatalog reaches CanonicalCatalog in the current stack', () => {
    const navigation = {navigate: jest.fn()};
    openLessonCatalog(navigation);
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledWith('CanonicalCatalog');
  });
});
