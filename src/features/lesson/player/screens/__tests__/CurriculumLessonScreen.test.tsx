import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {FeatureFlagProvider} from '@core/release';
import {makeTestReleaseConfig, THEME_UI_FLAGS} from '@test/support';
import {AppThemeProvider} from '@ui/theme';
import {CurriculumLessonScreen} from '../CurriculumLessonScreen';
import {
  parseCurriculumLessonAggregateResponse,
  type CurriculumLesson,
} from '../../logic/curriculumLessonSchema';
import type {
  CurriculumLessonCheckResult,
  CurriculumLessonResult,
} from '../../logic/curriculumLessonClient';
import learnerLessonFixture from '../../logic/__tests__/fixtures/valid-learner-lesson-aggregate.json';

jest.mock('../../logic/curriculumLessonClient', () => ({
  fetchCurriculumLesson: jest.fn(),
  checkCurriculumLessonExercise: jest.fn(),
}));

const {fetchCurriculumLesson, checkCurriculumLessonExercise} = jest.requireMock(
  '../../logic/curriculumLessonClient',
) as {
  fetchCurriculumLesson: jest.Mock;
  checkCurriculumLessonExercise: jest.Mock;
};

const LESSON_ID = '00000000-0000-4000-8000-000000000010';
const OTHER_LESSON_ID = '00000000-0000-4000-8000-000000000011';

function lessonFromFixture(): CurriculumLesson {
  const parsed = parseCurriculumLessonAggregateResponse({
    request_id: 'screen-test',
    status: 'success',
    lesson: learnerLessonFixture,
  });
  if (!parsed.ok) {
    throw new Error(`fixture failed to parse: ${parsed.message}`);
  }
  return parsed.lesson;
}

function lessonWithId(id: string, title: string): CurriculumLesson {
  const base = lessonFromFixture();
  return {...base, id, title};
}

function okResult(lesson: CurriculumLesson): CurriculumLessonResult {
  return {ok: true, requestId: 'req-1', lesson};
}

function checkOk(correct: boolean): CurriculumLessonCheckResult {
  return {ok: true, requestId: 'check-1', correct, explanation: {en: 'Why.'}};
}

function screenProps(
  lessonId: string,
  goBack: jest.Mock,
): React.ComponentProps<typeof CurriculumLessonScreen> {
  return {
    navigation: {goBack},
    route: {
      key: `curriculum-lesson-${lessonId}`,
      name: 'CurriculumLesson',
      params: {lessonId},
    },
  } as unknown as React.ComponentProps<typeof CurriculumLessonScreen>;
}

function screenElement(lessonId: string, goBack: jest.Mock) {
  return (
    <FeatureFlagProvider releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}>
      <AppThemeProvider>
        <CurriculumLessonScreen {...screenProps(lessonId, goBack)} />
      </AppThemeProvider>
    </FeatureFlagProvider>
  );
}

async function renderScreen(lessonId: string, goBack = jest.fn()) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(screenElement(lessonId, goBack));
  });
  return {tree, goBack};
}

async function updateLessonId(
  tree: ReactTestRenderer.ReactTestRenderer,
  lessonId: string,
  goBack: jest.Mock,
) {
  await act(async () => {
    tree.update(screenElement(lessonId, goBack));
  });
}

function hostExists(
  tree: ReactTestRenderer.ReactTestRenderer,
  testID: string,
): boolean {
  return (
    tree.root
      .findAllByProps({testID})
      .filter(node => typeof node.type === 'string').length > 0
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
}

describe('CurriculumLessonScreen', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    checkCurriculumLessonExercise.mockResolvedValue(checkOk(true));
  });

  it('loads the aggregate for the route lessonId and renders the player', async () => {
    const lesson = lessonFromFixture();
    fetchCurriculumLesson.mockResolvedValue(okResult(lesson));
    const {tree} = await renderScreen(LESSON_ID);

    expect(fetchCurriculumLesson).toHaveBeenCalledTimes(1);
    expect(fetchCurriculumLesson.mock.calls[0][0]).toBe(LESSON_ID);
    expect(hostExists(tree, 'curriculum-lesson-ready')).toBe(true);
    expect(hostExists(tree, 'lesson-player')).toBe(true);
  });

  it('shows loading state while the aggregate is in flight', async () => {
    const gate = deferred<CurriculumLessonResult>();
    fetchCurriculumLesson.mockReturnValue(gate.promise);
    const {tree} = await renderScreen(LESSON_ID);

    expect(hostExists(tree, 'curriculum-lesson-loading')).toBe(true);
    expect(hostExists(tree, 'curriculum-lesson-ready')).toBe(false);
    await act(async () => {
      gate.resolve(okResult(lessonFromFixture()));
    });
    expect(hostExists(tree, 'curriculum-lesson-ready')).toBe(true);
  });

  it('maps not-found (draft/archived lesson) to a safe-exit state', async () => {
    fetchCurriculumLesson.mockResolvedValue({
      ok: false,
      kind: 'not-found',
      errorCode: 'LESSON_NOT_FOUND',
      message: 'Lesson was not found.',
      retryable: false,
    });
    const {tree, goBack} = await renderScreen(LESSON_ID);

    expect(hostExists(tree, 'curriculum-lesson-error-not-found')).toBe(true);
    expect(hostExists(tree, 'curriculum-lesson-retry')).toBe(false);
    await press(tree, 'curriculum-lesson-exit');
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('treats an unknown 404 route (new App against old Server) as not-found', async () => {
    fetchCurriculumLesson.mockResolvedValue({
      ok: false,
      kind: 'not-found',
      errorCode: 'LESSON_NOT_FOUND',
      message: 'Request failed.',
      status: 404,
      retryable: false,
    });
    const {tree} = await renderScreen(LESSON_ID);

    expect(hostExists(tree, 'curriculum-lesson-error-not-found')).toBe(true);
    expect(hostExists(tree, 'lesson-player')).toBe(false);
  });

  it('maps transport/5xx failures to a retryable network state', async () => {
    fetchCurriculumLesson.mockResolvedValueOnce({
      ok: false,
      kind: 'network-error',
      errorCode: 'NETWORK_ERROR',
      message: 'Network connection lost.',
      retryable: true,
    });
    const {tree} = await renderScreen(LESSON_ID);
    expect(hostExists(tree, 'curriculum-lesson-error-network-error')).toBe(
      true,
    );

    fetchCurriculumLesson.mockResolvedValueOnce(okResult(lessonFromFixture()));
    await press(tree, 'curriculum-lesson-retry');
    expect(fetchCurriculumLesson).toHaveBeenCalledTimes(2);
    expect(hostExists(tree, 'curriculum-lesson-ready')).toBe(true);
  });

  it('maps LESSON_CONTENT_INVALID and malformed envelopes to content error', async () => {
    fetchCurriculumLesson.mockResolvedValue({
      ok: false,
      kind: 'content-error',
      errorCode: 'LESSON_CONTENT_INVALID',
      message: 'Lesson content is invalid.',
      retryable: false,
    });
    const {tree, goBack} = await renderScreen(LESSON_ID);

    expect(hostExists(tree, 'curriculum-lesson-error-content-error')).toBe(
      true,
    );
    expect(hostExists(tree, 'curriculum-lesson-retry')).toBe(false);
    await press(tree, 'curriculum-lesson-exit');
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('renders the player empty placeholder for an empty lesson', async () => {
    const lesson = lessonWithId(LESSON_ID, 'Empty lesson');
    fetchCurriculumLesson.mockResolvedValue(okResult({...lesson, blocks: []}));
    const {tree} = await renderScreen(LESSON_ID);

    expect(hostExists(tree, 'player-empty')).toBe(true);
    expect(hostExists(tree, 'player-retry')).toBe(true);
    expect(hostExists(tree, 'player-exit')).toBe(true);
  });

  it('renders unsupported-block fallback instead of crashing', async () => {
    const lesson = lessonFromFixture();
    const raw = {
      id: '00000000-0000-4000-8000-000000000099',
      type: 'mystery-future-block',
      position: 0,
    };
    const parsed = parseCurriculumLessonAggregateResponse({
      request_id: 'screen-unsupported',
      status: 'success',
      lesson: {...learnerLessonFixture, blocks: [raw]},
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.lesson.blocks[0].type).toBe('unsupported');
    fetchCurriculumLesson.mockResolvedValue({
      ok: true,
      requestId: 'req-unsupported',
      lesson: {...lesson, blocks: parsed.lesson.blocks},
    });
    const {tree} = await renderScreen(LESSON_ID);
    expect(hostExists(tree, 'block-unsupported')).toBe(true);
  });

  it('ignores a stale response after the lessonId changes', async () => {
    const first = deferred<CurriculumLessonResult>();
    const second = deferred<CurriculumLessonResult>();
    fetchCurriculumLesson
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const goBack = jest.fn();
    const {tree} = await renderScreen(LESSON_ID, goBack);
    await updateLessonId(tree, OTHER_LESSON_ID, goBack);

    await act(async () => {
      second.resolve(okResult(lessonWithId(OTHER_LESSON_ID, 'Second lesson')));
    });
    await act(async () => {
      first.resolve(okResult(lessonWithId(LESSON_ID, 'First lesson')));
    });

    const title = tree.root.findByProps({testID: 'player-title'});
    const text = (
      Array.isArray(title.props.children)
        ? title.props.children
        : [title.props.children]
    ).join('');
    expect(text).toBe('Second lesson');
  });

  it('aborts the in-flight load on unmount', async () => {
    const gate = deferred<CurriculumLessonResult>();
    const seen: {signal: AbortSignal | null} = {signal: null};
    fetchCurriculumLesson.mockImplementation(
      (_id: string, options?: {signal?: AbortSignal}) => {
        seen.signal = options?.signal ?? null;
        return gate.promise;
      },
    );
    const {tree} = await renderScreen(LESSON_ID);
    expect(seen.signal).not.toBeNull();
    await act(async () => {
      tree.unmount();
    });
    expect(seen.signal?.aborted).toBe(true);
    await act(async () => {
      gate.resolve(okResult(lessonFromFixture()));
    });
  });

  it('checks exercises through the live client and shows feedback', async () => {
    fetchCurriculumLesson.mockResolvedValue(okResult(lessonFromFixture()));
    const {tree} = await renderScreen(LESSON_ID);

    for (let step = 0; step < 4; step += 1) {
      await press(tree, 'player-next');
    }
    await press(tree, 'exercise-option-a');
    checkCurriculumLessonExercise.mockResolvedValueOnce(checkOk(false));
    await press(tree, 'exercise-submit');

    expect(checkCurriculumLessonExercise).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000040',
      {optionId: 'a'},
    );
    expect(hostExists(tree, 'exercise-feedback-incorrect')).toBe(true);

    checkCurriculumLessonExercise.mockResolvedValueOnce(checkOk(true));
    await press(tree, 'exercise-option-b');
    await press(tree, 'exercise-submit');
    expect(hostExists(tree, 'exercise-feedback-correct')).toBe(true);
  });

  it('reaches Complete with safe exit and persists nothing', async () => {
    fetchCurriculumLesson.mockResolvedValue(okResult(lessonFromFixture()));
    const {tree, goBack} = await renderScreen(LESSON_ID);

    for (let step = 0; step < 5; step += 1) {
      await press(tree, 'player-next');
    }
    expect(hostExists(tree, 'player-complete')).toBe(true);
    await press(tree, 'player-complete-exit');
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
    expect(jest.mocked(AsyncStorage.setItem)).not.toHaveBeenCalled();
  });
});
