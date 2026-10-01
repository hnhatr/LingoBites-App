import type {HomeStackParamList} from '../../screens/navigationTypes';

type Nav = {
  navigate: (...args: unknown[]) => void;
};

describe('Home stack navigation types', () => {
  it('accepts canonical player and catalog routes', () => {
    const nav = {navigate: jest.fn()} as Nav & {
      navigate: <T extends keyof HomeStackParamList>(
        screen: T,
        params?: HomeStackParamList[T],
      ) => void;
    };
    nav.navigate('CanonicalLessonPlayer', {lessonId: 'lesson-1'});
    nav.navigate('CanonicalCatalog');
    nav.navigate('DailyReview');
    nav.navigate('Today');
    expect(nav.navigate).toHaveBeenCalled();
  });
});
