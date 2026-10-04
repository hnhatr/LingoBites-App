import * as RNFS from '@dr.pogodin/react-native-fs';

import {
  configureRemoteRecordingPlayback,
  playSummarySentenceRecording,
  requestServerRecordingContent,
  resetRemoteRecordingPlaybackForTests,
  shouldShowSummaryPlayButton,
} from '../remoteRecordingPlayback';

jest.mock('@core/api/appConfig', () => ({
  getAppConfig: () => ({apiBaseUrl: 'https://api.lingobites.app'}),
}));

const mockAuthenticatedFetch = jest.fn();
jest.mock('@core/api/authenticatedFetch', () => ({
  authenticatedFetch: (...args: unknown[]) => mockAuthenticatedFetch(...args),
}));

describe('remoteRecordingPlayback', () => {
  beforeEach(() => {
    resetRemoteRecordingPlaybackForTests();
    mockAuthenticatedFetch.mockReset();
  });

  it('AC-030 S2: hides play when there is no local file and no server recording', () => {
    expect(
      shouldShowSummaryPlayButton({
        recordingId: 'rec-1',
        localFilePath: null,
        serverRecordingId: null,
      }),
    ).toBe(false);
  });

  it('AC-030 S1: requests Server content for the recording id when playing remotely', async () => {
    mockAuthenticatedFetch.mockResolvedValue({
      ok: true,
      text: async () => 'audio-bytes',
    });
    const writeFile = jest.fn().mockResolvedValue(undefined);
    configureRemoteRecordingPlayback({
      fileExists: async () => false,
      writeFile,
      playLocal: jest.fn(),
    });
    await playSummarySentenceRecording({
      recordingId: 'client-rec',
      localFilePath: null,
      serverRecordingId: '55555555-5555-4555-8555-555555555555',
    });
    expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
      'https://api.lingobites.app/v1/recordings/55555555-5555-4555-8555-555555555555/content',
      {method: 'GET'},
      fetch,
    );
  });

  it('CR-001-red: writes cache file without explicit writeFile dep', async () => {
    resetRemoteRecordingPlaybackForTests();
    mockAuthenticatedFetch.mockResolvedValue({ok: true, text: async () => 'a'});
    const writeFile = jest
      .spyOn(RNFS, 'writeFile')
      .mockResolvedValue(undefined as never);
    configureRemoteRecordingPlayback({
      fileExists: jest.fn().mockResolvedValue(false),
    });
    await requestServerRecordingContent('55555555-5555-4555-8555-555555555555');
    expect(writeFile).toHaveBeenCalled();
    writeFile.mockRestore();
  });

  it('requestServerRecordingContent rejects empty HTTP 200 body', async () => {
    mockAuthenticatedFetch.mockResolvedValue({ok: true, text: async () => ''});
    const writeFile = jest.fn().mockResolvedValue(undefined);
    configureRemoteRecordingPlayback({writeFile});
    const result = await requestServerRecordingContent(
      '55555555-5555-4555-8555-555555555555',
    );
    expect(result).toEqual({ok: false, errorCode: 'EMPTY_CONTENT'});
    expect(writeFile).not.toHaveBeenCalled();
  });
});
