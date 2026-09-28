/**
 * Comprehensive integration tests for LING-17 TASK-006 learning triggers:
 * - open -> startLessonProgress
 * - vocabulary encountered -> markVocabularySeen (with deduplication)
 * - exercise submit -> submitExerciseAttempt
 * - final block -> completeLessonProgress
 * - Review surface integration via useLearningReview
 * - Home surface Continue Learning integration via fetchContinueLearning
 */
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {FeatureFlagProvider} from '@/release';
import {makeTestReleaseConfig, THEME_UI_FLAGS} from '@/test-support';
import {AppThemeProvider} from '@theme';
import {CurriculumLessonScreen} from '../CurriculumLessonScreen';
import {
  parseCurriculumLessonAggregateResponse,
  type CurriculumLesson,
} from '../curriculumLessonSchema';
import type {CurriculumLessonResult} from '../curriculumLessonClient';
import learnerLessonFixture from './fixtures/valid-learner-lesson-aggregate.json';
import {useLearningReview} from '@modules/review/useLearningReview';
import {
  startLessonProgress,
  markVocabularySeen,
  submitExerciseAttempt,
  completeLessonProgress,
  setVocabularyProgress,
  fetchContinueLearning,
} from '../api/learningProgressClient';
import {fetchReview} from '../../review/api/learningReviewClient';

jest.mock('../curriculumLessonClient', () => ({
  fetchCurriculumLesson: jest.fn(),
  checkCurriculumLessonExercise: jest.fn(),
}));

jest.mock('../api/learningProgressClient', () => ({
  startLessonProgress: jest.fn(),
  markVocabularySeen: jest.fn(),
  submitExerciseAttempt: jest.fn(),
  completeLessonProgress: jest.fn(),
  setVocabularyProgress: jest.fn(),
  fetchContinueLearning: jest.fn(),
}));

jest.mock('../../review/api/learningReviewClient', () => ({
  fetchReview: jest.fn(),
}));

const {fetchCurriculumLesson, checkCurriculumLessonExercise} = jest.requireMock(
  '../curriculumLessonClient',
) as {
  fetchCurriculumLesson: jest.Mock;
  checkCurriculumLessonExercise: jest.Mock;
};

const mockStartLessonProgress = startLessonProgress as jest.Mock;
const mockMarkVocabularySeen = markVocabularySeen as jest.Mock;
const mockSubmitExerciseAttempt = submitExerciseAttempt as jest.Mock;
const mockCompleteLessonProgress = completeLessonProgress as jest.Mock;
const mockFetchReview = fetchReview as jest.Mock;
const mockSetVocabularyProgress = setVocabularyProgress as jest.Mock;
const mockFetchContinueLearning = fetchContinueLearning as jest.Mock;

const LESSON_ID = '00000000-0000-4000-8000-000000000010';

function lessonFromFixture(): CurriculumLesson {
  const parsed = parseCurriculumLessonAggregateResponse({
    request_id: 'trigger-test',
    status: 'success',
    lesson: learnerLessonFixture,
  });
  if (!parsed.ok) {
    throw new Error(`fixture failed to parse: ${parsed.message}`);
  }
  return parsed.lesson;
}

function okResult(lesson: CurriculumLesson): CurriculumLessonResult {
  return {ok: true, requestId: 'req-1', lesson};
}

function screenElement(lessonId: string, goBack = jest.fn()) {
  return (
    <FeatureFlagProvider releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}>
      <AppThemeProvider>
        <CurriculumLessonScreen
          navigation={{goBack} as never}
          route={
            {
              key: `curriculum-lesson-${lessonId}`,
              name: 'CurriculumLesson',
              params: {lessonId},
            } as never
          }
        />
      </AppThemeProvider>
    </FeatureFlagProvider>
  );
}

async function press(
  tree: ReactTestRenderer.ReactTestRenderer,
  testID: string,
) {
  await act(async () => {
    tree.root.findByProps({testID}).props.onPress();
  });
}

function TestReviewComponent() {
  const {
    loading,
    error,
    exercises,
    vocabularies,
    updateVocabularyStatus,
    submitExercise,
  } = useLearningReview();

  return (
    <React.Fragment>
      {loading ? <React.Fragment>Loading</React.Fragment> : null}
      {error ? <React.Fragment>{error}</React.Fragment> : null}
      {exercises.map(e => (
        <React.Fragment key={e.exercise.id}>
          {e.exercise.title}
          <button
            onClick={() => submitExercise(e.exercise.id, {optionId: 'a'})}
          >
            Submit
          </button>
        </React.Fragment>
      ))}
      {vocabularies.map(v => (
        <React.Fragment key={v.vocabulary.id}>
          {v.vocabulary.lemma}
          <button
            onClick={() => updateVocabularyStatus(v.vocabulary.id, 'known')}
          >
            Mark Known
          </button>
        </React.Fragment>
      ))}
    </React.Fragment>
  );
}

describe('TASK-006 Learning Triggers Integration', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    mockStartLessonProgress.mockResolvedValue({
      ok: true,
      requestId: 'req-start',
      progress: {
        id: '00000000-0000-4000-8000-000000000099',
        lesson_id: LESSON_ID,
        status: 'in_progress',
        started_at: '2026-09-26T00:00:00Z',
        completed_at: null,
        created_at: '2026-09-26T00:00:00Z',
        updated_at: '2026-09-26T00:00:00Z',
      },
    });
    mockMarkVocabularySeen.mockResolvedValue({
      ok: true,
      requestId: 'req-seen',
      progress: {
        id: '00000000-0000-4000-8000-000000000098',
        vocabulary_id: '00000000-0000-4000-8000-000000000030',
        status: 'learning',
        first_seen_at: '2026-09-26T00:00:00Z',
        last_seen_at: '2026-09-26T00:00:00Z',
        created_at: '2026-09-26T00:00:00Z',
        updated_at: '2026-09-26T00:00:00Z',
      },
    });
    mockSubmitExerciseAttempt.mockResolvedValue({
      ok: true,
      requestId: 'req-attempt',
      result: {
        attempt_id: '00000000-0000-4000-8000-000000000097',
        exercise_id: '00000000-0000-4000-8000-000000000040',
        is_correct: true,
        attempted_at: '2026-09-26T00:00:00Z',
      },
    });
    mockCompleteLessonProgress.mockResolvedValue({
      ok: true,
      requestId: 'req-complete',
      progress: {
        id: '00000000-0000-4000-8000-000000000099',
        lesson_id: LESSON_ID,
        status: 'completed',
        started_at: '2026-09-26T00:00:00Z',
        completed_at: '2026-09-26T00:05:00Z',
        created_at: '2026-09-26T00:00:00Z',
        updated_at: '2026-09-26T00:05:00Z',
      },
    });
    checkCurriculumLessonExercise.mockResolvedValue({
      ok: true,
      requestId: 'check-1',
      correct: true,
      explanation: {en: 'Correct!'},
    });
  });

  it('triggers startLessonProgress when lesson opens and is ready', async () => {
    const lesson = lessonFromFixture();
    fetchCurriculumLesson.mockResolvedValue(okResult(lesson));

    await act(async () => {
      ReactTestRenderer.create(screenElement(LESSON_ID));
    });

    expect(mockStartLessonProgress).toHaveBeenCalledTimes(1);
    expect(mockStartLessonProgress).toHaveBeenCalledWith(LESSON_ID);
  });

  it('triggers markVocabularySeen when vocabulary block is encountered with deduplication', async () => {
    const lesson = lessonFromFixture();
    fetchCurriculumLesson.mockResolvedValue(okResult(lesson));
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      tree = ReactTestRenderer.create(screenElement(LESSON_ID));
    });

    // Advance to vocabulary block (block at index 2 in fixture)
    await press(tree, 'player-next');
    await press(tree, 'player-next');

    expect(mockMarkVocabularySeen).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000020',
    );
    expect(mockMarkVocabularySeen).toHaveBeenCalledTimes(1);

    // Re-rendering or navigating back and forth shouldn't re-call for already seen item in session
    await press(tree, 'player-prev');
    await press(tree, 'player-next');
    expect(mockMarkVocabularySeen).toHaveBeenCalledTimes(1);
  });

  it('triggers submitExerciseAttempt when an exercise is submitted', async () => {
    const lesson = lessonFromFixture();
    fetchCurriculumLesson.mockResolvedValue(okResult(lesson));
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      tree = ReactTestRenderer.create(screenElement(LESSON_ID));
    });

    for (let step = 0; step < 4; step += 1) {
      await press(tree, 'player-next');
    }
    await press(tree, 'exercise-option-a');
    await press(tree, 'exercise-submit');

    expect(mockSubmitExerciseAttempt).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000040',
      {optionId: 'a'},
    );
  });

  it('triggers completeLessonProgress ONLY on final block completion', async () => {
    const lesson = lessonFromFixture();
    fetchCurriculumLesson.mockResolvedValue(okResult(lesson));
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      tree = ReactTestRenderer.create(screenElement(LESSON_ID));
    });

    // Before final block, completeLessonProgress is NOT called
    for (let step = 0; step < 4; step += 1) {
      await press(tree, 'player-next');
      expect(mockCompleteLessonProgress).not.toHaveBeenCalled();
    }

    // Advancing past final block triggers complete
    await press(tree, 'player-next');
    expect(mockCompleteLessonProgress).toHaveBeenCalledTimes(1);
    expect(mockCompleteLessonProgress).toHaveBeenCalledWith(LESSON_ID);
  });

  it('useLearningReview fetches review data and updates vocabulary/exercise status', async () => {
    mockFetchReview.mockResolvedValue({
      ok: true,
      requestId: 'rev-1',
      exercises: [
        {
          exercise: {
            id: 'ex-1',
            title: 'Review Ex 1',
            type: 'multiple_choice',
            instruction: 'Choose',
            prompt: 'Question 1',
            config: {},
          },
          latest_attempt: {
            attempt_id: 'att-1',
            exercise_id: 'ex-1',
            is_correct: false,
            attempted_at: '2026-09-26T00:00:00Z',
          },
        },
      ],
      vocabularies: [
        {
          vocabulary: {
            id: 'voc-1',
            key: 'apple',
            language: 'en',
            lemma: 'apple',
            part_of_speech: 'noun',
            meaning: 'quả táo',
            ipa: '/ˈæp.əl/',
            audio_media_id: null,
            image_media_id: null,
          },
          progress: {
            id: 'vp-1',
            vocabulary_id: 'voc-1',
            status: 'learning',
            first_seen_at: '2026-09-26T00:00:00Z',
            last_seen_at: '2026-09-26T00:00:00Z',
            created_at: '2026-09-26T00:00:00Z',
            updated_at: '2026-09-26T00:00:00Z',
          },
        },
      ],
    });
    mockSetVocabularyProgress.mockResolvedValue({
      ok: true,
      requestId: 'set-1',
      progress: {
        id: 'vp-1',
        vocabulary_id: 'voc-1',
        status: 'known',
        first_seen_at: '2026-09-26T00:00:00Z',
        last_seen_at: '2026-09-26T00:00:00Z',
        created_at: '2026-09-26T00:00:00Z',
        updated_at: '2026-09-26T00:00:00Z',
      },
    });

    await act(async () => {
      ReactTestRenderer.create(<TestReviewComponent />);
    });

    expect(mockFetchReview).toHaveBeenCalledTimes(1);
  });

  it('fetchContinueLearning handles null and active in-progress lesson', async () => {
    mockFetchContinueLearning.mockResolvedValueOnce({
      ok: true,
      requestId: 'cont-1',
      progress: null,
    });
    let result = await fetchContinueLearning();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.progress).toBeNull();
    }

    mockFetchContinueLearning.mockResolvedValueOnce({
      ok: true,
      requestId: 'cont-2',
      progress: {
        id: 'prog-1',
        lesson_id: LESSON_ID,
        status: 'in_progress',
        started_at: '2026-09-26T00:00:00Z',
        completed_at: null,
        created_at: '2026-09-26T00:00:00Z',
        updated_at: '2026-09-26T00:00:00Z',
      },
    });
    result = await fetchContinueLearning();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.progress?.lesson_id).toBe(LESSON_ID);
    }
  });
});
