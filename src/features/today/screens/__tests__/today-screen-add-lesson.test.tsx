import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {
  CORE_WITH_REVIEW,
  makeTestReleaseConfig,
  mockAppNavigation,
} from '@test/support';

import {DEFAULT_TODAY_FEATURES} from '../../logic/todayFeatures';
import type {StudyBlockPlan} from '../../logic/types';
import {TodayScreen} from '../TodayScreen';

/** Today: add a lesson (create / library / course) as the admin allows. */

jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react');
  return {
    useNavigation: () => ({navigate: jest.fn(), goBack: jest.fn()}),
    useFocusEffect: (cb: () => void) => {
      ReactModule.useEffect(() => cb(), [cb]);
    },
  };
});

jest.mock('@features/review', () => ({
  getDueFlashcards: () => [],
  countItemsForReview: () => 0,
}));

type MockNextPack = {
  packId: string;
  titleVi: string;
  learned: number;
  total: number;
} | null;

const PACK_ONE: MockNextPack = {
  packId: 'pack-1',
  titleVi: 'Gói A1 · chung 1',
  learned: 3,
  total: 12,
};
let mockNextPack: MockNextPack = PACK_ONE;
let mockSync: () => Promise<number> = () => Promise.resolve(0);

jest.mock('@features/wordPath', () => ({
  nextDownloadedPack: () => mockNextPack,
  syncDownloadedPacks: () => mockSync(),
}));

jest.mock('../../logic/todayAdapter', () => ({
  getLearnerStateSnapshot: () => ({
    dueReviewCount: 0,
    estimatedReviewMinutes: 0,
    recentErrors: [],
    speakingRecordings: [],
    lastSpeakingAtIso: null,
    hasDownloadedLessons: true,
    lessonProgression: null,
    profileData: null,
  }),
}));

let mockFeatures = {...DEFAULT_TODAY_FEATURES};

jest.mock('../../logic/todayFeatures', () => {
  const actual = jest.requireActual('../../logic/todayFeatures');
  return {
    ...actual,
    readTodayFeatures: () => mockFeatures,
    refreshTodayFeatures: () => Promise.resolve(mockFeatures),
  };
});

let mockMinutes = 10;

jest.mock('../../logic/adaptationEngine', () => {
  const actual = jest.requireActual('../../logic/adaptationEngine');
  return {
    ...actual,
    generateStudyBlock: (): StudyBlockPlan => ({
      mode: 'normal',
      isConsolidation: false,
      totalEstimatedMinutes: mockMinutes,
      reasonCodes: [],
      explanationVi: 'Kế hoạch kiểm thử.',
      activities: [
        {
          id: 'activity-continue',
          type: 'continue_lesson',
          titleVi: 'Học tiếp: Chào hỏi',
          subtitleVi: 'Tiếp tục bài đang học dở',
          estimatedMinutes: mockMinutes,
          targetId: 'lesson-1',
          navigationTarget: {
            screen: 'CanonicalLessonPlayer',
            params: {lessonId: 'lesson-1'},
          },
        },
      ],
    }),
  };
});

async function renderToday() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(CORE_WITH_REVIEW)}
      >
        <AppThemeProvider>
          <TodayScreen />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
    await Promise.resolve();
  });
  return tree;
}

function pressables(tree: ReactTestRenderer.ReactTestRenderer, testID: string) {
  return tree.root.findAll(
    node =>
      node.props.testID === testID && typeof node.props.onPress === 'function',
  );
}

function press(tree: ReactTestRenderer.ReactTestRenderer, testID: string) {
  const [target] = pressables(tree, testID);
  if (!target) throw new Error(`No pressable found for ${testID}`);
  act(() => {
    target.props.onPress();
  });
}

describe('TodayScreen add lesson', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFeatures = {...DEFAULT_TODAY_FEATURES};
    mockMinutes = 10;
    mockNextPack = PACK_ONE;
    mockSync = () => Promise.resolve(0);
  });

  it('offers create, library and course where the plan has minutes to spare', async () => {
    const tree = await renderToday();
    expect(
      tree.root.findAllByProps({testID: 'shortfall-container'}).length,
    ).toBeGreaterThan(0);
    press(tree, 'add-lesson-create');
    expect(mockAppNavigation.openCreate).toHaveBeenCalledTimes(1);
    press(tree, 'add-lesson-library');
    expect(mockAppNavigation.goToTab).toHaveBeenCalledWith('Lessons');
    press(tree, 'add-lesson-course');
    expect(mockAppNavigation.openCourse).toHaveBeenCalledWith();
  });

  it('hides the ways to add a lesson the admin switched off', async () => {
    mockFeatures = {...DEFAULT_TODAY_FEATURES, 'add_lesson.course': false};
    const tree = await renderToday();
    expect(pressables(tree, 'add-lesson-create')).toHaveLength(1);
    expect(pressables(tree, 'add-lesson-course')).toHaveLength(0);
  });

  it('opens the add-lesson sheet from the link when the plan is full', async () => {
    mockMinutes = 20;
    const tree = await renderToday();
    expect(
      tree.root.findAllByProps({testID: 'shortfall-container'}),
    ).toHaveLength(0);
    press(tree, 'add-lesson-open');
    press(tree, 'add-lesson-sheet-course');
    expect(mockAppNavigation.openCourse).toHaveBeenCalledTimes(1);
  });

  it('starts the first activity from the start button', async () => {
    const tree = await renderToday();
    press(tree, 'today-start');
    expect(mockAppNavigation.openLesson).toHaveBeenCalledWith('lesson-1');
  });

  it('shows the word pack only while its feature is on', async () => {
    const tree = await renderToday();
    expect(pressables(tree, 'today-next-pack')).toHaveLength(1);

    mockFeatures = {...DEFAULT_TODAY_FEATURES, word_pack: false};
    const hidden = await renderToday();
    expect(pressables(hidden, 'today-next-pack')).toHaveLength(0);
  });

  it('picks the next pack again after stale packs are dropped', async () => {
    mockSync = () => {
      mockNextPack = null;
      return Promise.resolve(1);
    };
    const tree = await renderToday();
    await act(async () => {
      await Promise.resolve();
    });
    expect(pressables(tree, 'today-next-pack')).toHaveLength(0);
  });

  it('keeps the next pack when the sync fails', async () => {
    mockSync = () => Promise.reject(new Error('offline'));
    const tree = await renderToday();
    await act(async () => {
      await Promise.resolve();
    });
    expect(pressables(tree, 'today-next-pack')).toHaveLength(1);
  });
});
