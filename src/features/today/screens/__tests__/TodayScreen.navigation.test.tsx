import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {CORE_WITH_REVIEW, makeTestReleaseConfig} from '@test/support';

import type {StudyBlockPlan} from '../../logic/types';
import {TodayScreen} from '../TodayScreen';

const mockNavigate = jest.fn();

jest.mock('@features/speaking', () => {
  const actual = jest.requireActual('@features/speaking');
  return {
    ...actual,
    resolveShadowingEntry: jest.fn(() => ({screen: 'ShadowingLessonPicker'})),
  };
});

jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react');
  return {
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: jest.fn(),
    }),
    useFocusEffect: (cb: () => void) => {
      ReactModule.useEffect(() => {
        cb();
      }, [cb]);
    },
  };
});

jest.mock('@features/review', () => ({
  getDueFlashcards: () => [],
}));

let mockHasDownloads = false;

jest.mock('../../logic/todayAdapter', () => ({
  getLearnerStateSnapshot: () => ({
    dueReviewCount: 0,
    estimatedReviewMinutes: 0,
    recentErrors: [],
    speakingRecordings: [],
    lastSpeakingAtIso: null,
    hasDownloadedLessons: mockHasDownloads,
    lessonProgression: null,
    profileData: null,
  }),
}));

const PLAYER_LESSON_ID = '33333333-3333-4333-8333-333333333301';

const defaultStudyPlan = () =>
  ({
    mode: 'normal',
    isConsolidation: false,
    totalEstimatedMinutes: 20,
    reasonCodes: [],
    explanationVi: 'Kế hoạch kiểm thử.',
    activities: [
      {
        id: 'activity-player',
        type: 'next_lesson',
        titleVi: 'Bài học mới',
        subtitleVi: 'Mở bài trong player',
        estimatedMinutes: 5,
        targetId: PLAYER_LESSON_ID,
        navigationTarget: {
          screen: 'CanonicalLessonPlayer',
          params: {lessonId: PLAYER_LESSON_ID},
        },
      },
      {
        id: 'activity-catalog',
        type: 'catalog',
        titleVi: 'Mở thư viện',
        subtitleVi: 'Duyệt tất cả bài học',
        estimatedMinutes: 5,
        navigationTarget: {screen: 'CanonicalCatalog'},
      },
      {
        id: 'activity-speaking',
        type: 'speaking_practice',
        titleVi: 'Luyện phát âm',
        subtitleVi: 'Phòng Luyện Nói',
        estimatedMinutes: 5,
        targetId: 'speaking_room',
        navigationTarget: {screen: 'SpeakingRoom'},
      },
      {
        id: 'activity-review',
        type: 'due_review',
        titleVi: 'Ôn tập',
        subtitleVi: 'Thẻ đến hạn',
        estimatedMinutes: 5,
        targetId: 'due_review',
        navigationTarget: {screen: 'DailyReview'},
      },
    ],
  } as StudyBlockPlan);

const mockGenerateStudyBlock = jest.fn<StudyBlockPlan, []>(defaultStudyPlan);

jest.mock('../../logic/adaptationEngine', () => {
  const actual = jest.requireActual('../../logic/adaptationEngine');
  return {
    ...actual,
    generateStudyBlock: () => mockGenerateStudyBlock(),
  };
});

async function renderTodayScreen() {
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

function press(tree: ReactTestRenderer.ReactTestRenderer, testID: string) {
  const target = tree.root
    .findAll(node => node.props.testID === testID)
    .find(node => typeof node.props.onPress === 'function');
  if (!target) throw new Error(`No pressable found for ${testID}`);
  act(() => {
    target.props.onPress();
  });
}

describe('TodayScreen entry points (LING-179 TASK-001)', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockHasDownloads = true;
    mockGenerateStudyBlock.mockImplementation(defaultStudyPlan);
  });

  it('opens the player with the same lessonId from a lesson activity', async () => {
    const tree = await renderTodayScreen();
    press(tree, 'activity-item-0');
    expect(mockNavigate).toHaveBeenCalledWith('CanonicalLessonPlayer', {
      lessonId: PLAYER_LESSON_ID,
    });
  });

  it('opens the catalog from a catalog activity', async () => {
    const tree = await renderTodayScreen();
    press(tree, 'activity-item-1');
    expect(mockNavigate).toHaveBeenCalledWith('CanonicalCatalog');
  });

  it('reaches SpeakingRoom from a speaking activity', async () => {
    const tree = await renderTodayScreen();
    press(tree, 'activity-item-2');
    expect(mockNavigate).toHaveBeenCalledWith('SpeakingRoom');
  });

  it('falls back to DailyReview for review activities', async () => {
    const tree = await renderTodayScreen();
    press(tree, 'activity-item-3');
    expect(mockNavigate).toHaveBeenCalledWith('DailyReview');
  });

  it('opens the catalog from the empty-downloads library action', async () => {
    mockHasDownloads = false;
    const tree = await renderTodayScreen();
    press(tree, 'today-go-download');
    expect(mockNavigate).toHaveBeenCalledWith('CanonicalCatalog');
  });
});

describe('TodayScreen shadowing entry (LING-244)', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockHasDownloads = true;
    mockGenerateStudyBlock.mockImplementation(defaultStudyPlan);
  });

  it('AC-002 S1: speaking-gap navigates to the shadowing flow, not SpeakingRoom', async () => {
    mockGenerateStudyBlock.mockReturnValueOnce({
      mode: 'normal',
      isConsolidation: false,
      totalEstimatedMinutes: 10,
      reasonCodes: ['SPEAKING_GAP_PRIORITY'],
      explanationVi: 'Gap',
      activities: [
        {
          id: 'activity-speaking-gap',
          type: 'speaking_practice',
          titleVi: 'Luyện phát âm',
          subtitleVi: 'Shadowing',
          estimatedMinutes: 5,
          navigationTarget: {screen: 'SpeakingShadowing'},
        },
      ],
    });
    const tree = await renderTodayScreen();
    press(tree, 'activity-item-0');
    expect(mockNavigate).toHaveBeenCalledWith('ShadowingLessonPicker');
    expect(mockNavigate).not.toHaveBeenCalledWith('SpeakingRoom');
  });

  it('AC-002 S2: interview activity still opens SpeakingRoom', async () => {
    mockGenerateStudyBlock.mockReturnValueOnce({
      mode: 'normal',
      isConsolidation: false,
      totalEstimatedMinutes: 10,
      reasonCodes: ['INTERVIEW_PORTFOLIO_PRIORITY'],
      explanationVi: 'Interview',
      activities: [
        {
          id: 'activity-interview',
          type: 'interview_practice',
          titleVi: 'Phỏng vấn',
          subtitleVi: 'Speaking room',
          estimatedMinutes: 10,
          navigationTarget: {screen: 'SpeakingRoom'},
        },
      ],
    });
    const tree = await renderTodayScreen();
    press(tree, 'activity-item-0');
    expect(mockNavigate).toHaveBeenCalledWith('SpeakingRoom');
  });
});
