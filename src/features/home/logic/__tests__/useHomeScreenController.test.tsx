import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {getGamificationSnapshot} from '@features/engagement';
import type {GamificationSnapshot} from '@features/engagement/logic/gamificationPolicy';
import {listDownloadedLessonSummaries} from '@features/lesson/player';

import {listInProgressLessonIds} from '@core/sync/lessonProgress';

import {useHomeScreenController} from '../useHomeScreenController';

jest.mock('@features/engagement', () => ({
  getGamificationSnapshot: jest.fn(),
}));

jest.mock('@features/analytics', () => ({
  trackEvent: jest.fn(),
}));

jest.mock('@core/api/youtubeCapabilities', () => ({
  useYouTubeServerEnabled: () => false,
}));

jest.mock('@core/release', () => ({
  useFeatureFlags: () => ({
    config: {features: {youtubeLearning: false}},
  }),
}));

jest.mock('@features/account', () => ({
  useAccountStore: (
    selector: (state: {user?: {display_name?: string}}) => unknown,
  ) => selector({user: undefined}),
}));

jest.mock('@features/lesson/player', () => ({
  listDownloadedLessonSummaries: jest.fn().mockReturnValue([]),
  useCanonicalCatalog: () => ({
    refresh: jest.fn(),
    state: {status: 'idle' as const},
  }),
}));

jest.mock('@core/sync/lessonProgress', () => ({
  listInProgressLessonIds: jest.fn().mockReturnValue([]),
}));

const mockSnapshot = getGamificationSnapshot as jest.Mock;
const mockDownloads = listDownloadedLessonSummaries as jest.Mock;
const mockInProgress = listInProgressLessonIds as jest.Mock;

function download(lessonId: string, title: string) {
  return {
    lessonId,
    title,
    estimatedDurationMinutes: 7,
    snapshot: {source_type: 'text'},
  };
}

function baseSnapshot(
  overrides: Partial<GamificationSnapshot> = {},
): GamificationSnapshot {
  return {
    totalSessions: 0,
    totalXp: 0,
    currentStreak: 2,
    bestStreak: 2,
    waterUnits: 0,
    badges: [],
    pet: {
      stageId: 'seed',
      waterUnits: 0,
      waterForNextStage: 1,
      progressToNextStage: 0,
    },
    weeklyGoal: {completedThisWeek: 0, target: 6},
    ...overrides,
  };
}

jest.mock('@react-navigation/native', () => {
  const react = require('react');
  let latestFocus: (() => void) | undefined;
  return {
    useFocusEffect: (callback: () => void) => {
      latestFocus = callback;
      react.useEffect(() => {
        callback();
      }, []);
    },
    __runFocus: () => latestFocus?.(),
  };
});

function makeDriver() {
  let latest!: ReturnType<typeof useHomeScreenController>;
  function Driver() {
    latest = useHomeScreenController();
    return null;
  }
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(<Driver />);
  });
  return {latest: () => latest, tree};
}

describe('useHomeScreenController weekly goal (TC-4A / FR-005)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSnapshot.mockReturnValue(baseSnapshot());
  });

  it('derives the card from getGamificationSnapshot when Home gains focus', () => {
    mockSnapshot.mockReturnValue(
      baseSnapshot({
        weeklyGoal: {completedThisWeek: 4, target: 6},
      }),
    );
    const {latest} = makeDriver();
    expect(latest().weeklyGoalCard.completedThisWeek).toBe(4);
    expect(latest().weeklyGoalCard.ringPercent).toBe(67);
    expect(mockSnapshot.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('refreshes the card when the focus callback runs again (FR-005)', () => {
    mockSnapshot.mockReturnValue(
      baseSnapshot({weeklyGoal: {completedThisWeek: 1, target: 6}}),
    );
    const {latest} = makeDriver();
    expect(latest().weeklyGoalCard.completedThisWeek).toBe(1);

    mockSnapshot.mockReturnValue(
      baseSnapshot({weeklyGoal: {completedThisWeek: 5, target: 6}}),
    );
    const nav = require('@react-navigation/native');
    act(() => {
      nav.__runFocus();
    });
    expect(latest().weeklyGoalCard.completedThisWeek).toBe(5);
  });

  it('marks badge-kept hints when diligent is in the snapshot (AC-001 S4 wiring)', () => {
    mockSnapshot.mockReturnValue(
      baseSnapshot({
        badges: [{id: 'diligent'}],
        weeklyGoal: {completedThisWeek: 2, target: 6},
      }),
    );
    const {latest} = makeDriver();
    expect(latest().weeklyGoalCard.hintKey).toBe('home.weekly_goal_hint_kept');
  });
});

describe('useHomeScreenController continue learning (F5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSnapshot.mockReturnValue(baseSnapshot());
    mockDownloads.mockReturnValue([]);
    mockInProgress.mockReturnValue([]);
  });

  it('shows the most recently started downloaded lesson', () => {
    mockDownloads.mockReturnValue([
      download('lesson-a', 'Bài A'),
      download('lesson-b', 'Bài B'),
    ]);
    mockInProgress.mockReturnValue(['lesson-x', 'lesson-b', 'lesson-a']);
    const {latest} = makeDriver();
    expect(latest().heroState).toBe('in_progress');
    expect(latest().startedLesson).toEqual({
      id: 'lesson-b',
      titleVi: 'Bài B',
      estimatedDurationMinutes: 7,
    });
  });

  it('picks up a lesson started since the last focus', () => {
    mockDownloads.mockReturnValue([download('lesson-a', 'Bài A')]);
    const {latest} = makeDriver();
    expect(latest().heroState).toBe('saved_only');
    expect(latest().startedLesson).toBeNull();

    mockInProgress.mockReturnValue(['lesson-a']);
    const nav = require('@react-navigation/native');
    act(() => {
      nav.__runFocus();
    });
    expect(latest().heroState).toBe('in_progress');
    expect(latest().startedLesson?.id).toBe('lesson-a');
  });

  it('keeps the download count when the progress read fails', () => {
    mockDownloads.mockReturnValue([download('lesson-a', 'Bài A')]);
    mockInProgress.mockImplementation(() => {
      throw new Error('db');
    });
    const {latest} = makeDriver();
    expect(latest().libraryCount).toBe(1);
    expect(latest().startedLesson).toBeNull();
  });
});
