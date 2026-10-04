import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));

jest.mock('@features/account', () => {
  const state = {
    user: null,
    phase: 'authenticated',
    logout: jest.fn().mockResolvedValue(undefined),
  };
  const useAccountStore = Object.assign(
    (selector: (value: typeof state) => unknown) => selector(state),
    {getState: () => state},
  );
  return {useAccountStore};
});

jest.mock('@features/audio', () => ({
  formatCacheBytes: jest.fn(() => '1 KB'),
  playReadyChapterAudio: jest.fn(),
  useAudioLibrary: jest.fn(),
}));

jest.mock('@features/engagement', () => ({
  getGamificationSnapshot: jest.fn(() => ({currentStreak: 0})),
}));

jest.mock('@features/profile/logic/LocalDataDeletionService', () => ({
  clearAllLocalDataWithFiles: jest.fn(),
  clearSpeakingLocalData: jest.fn(),
}));

jest.mock('@core/api/appConfig', () => ({
  getSupportEmail: () => 'support@lingobites.app',
}));

jest.mock('@core/release', () => ({
  useFeatureFlags: () => ({isFeatureEnabled: () => false}),
}));

jest.mock('../../useProgressReport', () => ({
  useProgressReport: () => ({
    getCapabilityProgressReport: () => ({
      firstListenComprehensionRate: null,
    }),
  }),
}));

import {playReadyChapterAudio, useAudioLibrary} from '@features/audio';

import {
  type ProfileScreenViewModel,
  useProfileScreen,
} from '../../useProfileScreen';

describe('LING-255 retained Profile audio behavior', () => {
  beforeEach(() => {
    jest.mocked(useAudioLibrary).mockReturnValue({
      getAudioCacheStats: () => ({
        chapterCount: 1,
        assetCount: 1,
        readyBytes: 1024,
      }),
      listReadyAudioAssets: () => [
        {
          id: 'legacy-ready-audio',
          chapterId: 'legacy-chapter',
          url: 'https://cdn.example.test/legacy.mp3',
          localPath: '/managed/legacy.mp3',
          bytes: 1024,
          checksum: 'sha256:legacy-ready-audio',
          downloadStatus: 'ready',
          updatedAt: '2026-10-04T10:00:00.000Z',
        },
      ],
    });
    jest.mocked(playReadyChapterAudio).mockResolvedValue({ok: true});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('AC-003 S2 / INV-002: tapping the Profile audio row plays the first ready asset', async () => {
    let viewModel!: ProfileScreenViewModel;

    function ProfileHookProbe() {
      viewModel = useProfileScreen({navigate: jest.fn()} as never);
      return null;
    }

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<ProfileHookProbe />);
    });
    await ReactTestRenderer.act(async () => {
      await viewModel.handlePlayCachedAudio();
    });

    expect(playReadyChapterAudio).toHaveBeenCalledWith('legacy-ready-audio');
  });
});
