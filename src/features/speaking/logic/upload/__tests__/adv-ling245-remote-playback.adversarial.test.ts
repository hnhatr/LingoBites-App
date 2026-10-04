import * as RNFS from '@dr.pogodin/react-native-fs';

const mockAuthenticatedFetch = jest.fn();
const mockPlayRecording = jest.fn();

jest.mock('@core/api/appConfig', () => ({
  getAppConfig: () => ({apiBaseUrl: 'https://api.lingobites.app'}),
}));

jest.mock('@core/api/authenticatedFetch', () => ({
  authenticatedFetch: (...args: unknown[]) => mockAuthenticatedFetch(...args),
}));

jest.mock('../../recordingService', () => ({
  playRecording: (...args: unknown[]) => mockPlayRecording(...args),
}));

import {
  playSummarySentenceRecording,
  resetRemoteRecordingPlaybackForTests,
  shouldShowSummaryPlayButton,
} from '../remoteRecordingPlayback';

const SERVER_RECORDING_ID = '55555555-5555-4555-8555-555555555555';
const CACHE_PATH = `/mock/Documents/LingoBitesRecordings/_remote/${SERVER_RECORDING_ID}.m4a`;

describe('LING-245 adversarial remote playback', () => {
  beforeEach(() => {
    resetRemoteRecordingPlaybackForTests();
    mockAuthenticatedFetch.mockReset();
    mockPlayRecording.mockReset();
    jest.mocked(RNFS.exists).mockReset();
    jest.mocked(RNFS.mkdir).mockReset().mockResolvedValue(undefined);
    jest.mocked(RNFS.writeFile).mockReset();
  });

  it('ADV-001 / AC-030 S1: the production path persists and plays a downloaded Server recording', async () => {
    const persistedPaths = new Set<string>();
    jest
      .mocked(RNFS.exists)
      .mockImplementation(async path => persistedPaths.has(path));
    jest.mocked(RNFS.writeFile).mockImplementation(async path => {
      persistedPaths.add(path);
    });
    mockAuthenticatedFetch.mockResolvedValue({
      ok: true,
      text: async () => 'audio-bytes',
    });

    await playSummarySentenceRecording({
      recordingId: 'client-recording-id',
      localFilePath: null,
      serverRecordingId: SERVER_RECORDING_ID,
    });

    expect(persistedPaths.has(CACHE_PATH)).toBe(true);
    expect(mockPlayRecording).toHaveBeenCalledWith(CACHE_PATH);
  });

  it('ADV-002 / AC-030 S2: a stale local path without a Server recording exposes no play control', async () => {
    const row = {
      recordingId: 'client-recording-id',
      localFilePath: '/mock/Documents/LingoBitesRecordings/missing.m4a',
      serverRecordingId: null,
    };
    jest.mocked(RNFS.exists).mockResolvedValue(false);

    expect(await RNFS.exists(row.localFilePath)).toBe(false);
    expect(shouldShowSummaryPlayButton(row)).toBe(false);
  });
});
