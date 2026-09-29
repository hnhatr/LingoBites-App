import {resolveTodayNavigation} from '../todayNavigation';

describe('resolveTodayNavigation', () => {
  it('opens the content-package runtime screen for lesson targets', () => {
    expect(
      resolveTodayNavigation({
        screen: 'ContentLessonRuntime',
        params: {lessonId: 'lesson-1'},
      }),
    ).toEqual({screen: 'ContentLessonRuntime', lessonId: 'lesson-1'});
  });

  it('never routes to the removed v1 SavedLessonDetail screen', () => {
    const resolved = resolveTodayNavigation({
      screen: 'ContentLessonRuntime',
      params: {lessonId: 'lesson-1'},
    });
    expect(resolved.screen).not.toBe('SavedLessonDetail');
  });

  it('falls back to DailyReview when a lesson target has no lesson id', () => {
    expect(
      resolveTodayNavigation({screen: 'ContentLessonRuntime', params: {}}),
    ).toEqual({screen: 'DailyReview'});
    expect(resolveTodayNavigation({screen: 'ContentLessonRuntime'})).toEqual({
      screen: 'DailyReview',
    });
  });

  it('sends FlashcardList targets to DailyReview, not the removed screen', () => {
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
    ).toEqual({screen: 'LessonsList'});
  });
});
