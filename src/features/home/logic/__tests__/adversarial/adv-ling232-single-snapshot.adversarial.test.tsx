import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {getGamificationSnapshot} from '@features/engagement';
import type {GamificationSnapshot} from '@features/engagement/logic/gamificationPolicy';

import {useHomeScreenController} from '../../useHomeScreenController';

jest.mock('@features/engagement', () => ({
  getGamificationSnapshot: jest.fn(),
}));

jest.mock('@features/analytics', () => ({
  trackEvent: jest.fn(),
}));

jest.mock('@core/api/youtubeCapabilities', () => ({
  useYouTubeCapability: () => ({status: 'disabled', refresh: () => {}}),
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

jest.mock('@react-navigation/native', () => {
  const react = require('react');
  return {
    useFocusEffect: (callback: () => void) => {
      react.useEffect(() => {
        callback();
      }, []);
    },
  };
});

const mockSnapshot = getGamificationSnapshot as jest.Mock;

function snapshot(
  completedThisWeek: number,
  currentStreak: number,
): GamificationSnapshot {
  return {
    totalSessions: 0,
    totalXp: 0,
    currentStreak,
    bestStreak: currentStreak,
    waterUnits: 0,
    badges: [],
    pet: {
      stageId: 'seed',
      waterUnits: 0,
      waterForNextStage: 1,
      progressToNextStage: 0,
    },
    weeklyGoal: {completedThisWeek, target: 6, badgeTarget: 6},
  };
}

describe('LING-232 Home focus snapshot ownership', () => {
  it('ADV-001 / H5 / FR-005: initial focus adds no separate weekly-card snapshot read', async () => {
    mockSnapshot
      .mockReturnValueOnce(snapshot(1, 1))
      .mockReturnValue(snapshot(5, 5));

    let latest!: ReturnType<typeof useHomeScreenController>;
    function Driver() {
      latest = useHomeScreenController();
      return null;
    }

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<Driver />);
      await Promise.resolve();
    });

    expect(latest.streak).toBe(5);
    expect(latest.weeklyGoalCard.completedThisWeek).toBe(5);
    expect(mockSnapshot).toHaveBeenCalledTimes(2);

    await act(async () => tree.unmount());
  });
});
