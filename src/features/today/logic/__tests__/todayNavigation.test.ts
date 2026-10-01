import {resolveTodayNavigation} from '../todayNavigation';

describe('resolveTodayNavigation', () => {
  it('opens the canonical player for lesson targets', () => {
    expect(
      resolveTodayNavigation({
        screen: 'CanonicalLessonPlayer',
        params: {lessonId: 'lesson-1'},
      }),
    ).toEqual({screen: 'CanonicalLessonPlayer', lessonId: 'lesson-1'});
  });

  it('falls back to the catalog when a lesson target has no lesson id', () => {
    expect(
      resolveTodayNavigation({screen: 'CanonicalLessonPlayer', params: {}}),
    ).toEqual({screen: 'CanonicalCatalog'});
    expect(resolveTodayNavigation({screen: 'CanonicalLessonPlayer'})).toEqual({
      screen: 'CanonicalCatalog',
    });
  });

  it('sends FlashcardList targets to DailyReview', () => {
    expect(
      resolveTodayNavigation({
        screen: 'FlashcardList',
        params: {lessonId: 'lesson-1'},
      }),
    ).toEqual({screen: 'DailyReview'});
  });

  it('keeps DailyReview and SpeakingRoom mappings unchanged', () => {
    expect(resolveTodayNavigation({screen: 'DailyReview'})).toEqual({
      screen: 'DailyReview',
    });
    expect(
      resolveTodayNavigation({
        screen: 'SpeakingRoom',
        params: {sentenceText: 'Hello'},
      }),
    ).toEqual({screen: 'SpeakingRoom'});
  });
});
