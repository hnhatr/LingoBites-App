import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {getGamificationSnapshot} from '@features/engagement';
import type {GamificationSnapshot} from '@features/engagement/logic/gamificationPolicy';

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
  fetchContinueLearning: jest
    .fn()
    .mockResolvedValue({ok: true, progress: null}),
  listDownloadedLessonSummaries: jest.fn().mockReturnValue([]),
  useCanonicalCatalog: () => ({
    refresh: jest.fn(),
    state: {status: 'idle' as const},
  }),
}));

const mockSnapshot = getGamificationSnapshot as jest.Mock;

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
