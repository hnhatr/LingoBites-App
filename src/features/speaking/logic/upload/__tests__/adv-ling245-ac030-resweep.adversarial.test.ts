const mockAuthenticatedFetch = jest.fn();

jest.mock('@core/api/appConfig', () => ({
  getAppConfig: () => ({apiBaseUrl: 'https://api.lingobites.app'}),
}));

jest.mock('@core/api/authenticatedFetch', () => ({
  authenticatedFetch: (...args: unknown[]) => mockAuthenticatedFetch(...args),
}));

import {
  configureRemoteRecordingPlayback,
  playSummarySentenceRecording,
  resetRemoteRecordingPlaybackForTests,
} from '../remoteRecordingPlayback';

const SERVER_RECORDING_ID = '55555555-5555-4555-8555-555555555555';
const LOCAL_PATH = '/local/corrupt.m4a';
const CACHE_PATH = `/mock/Documents/LingoBitesRecordings/_remote/${SERVER_RECORDING_ID}.m4a`;

describe('LING-245 AC-030 final adversarial sweep', () => {
  beforeEach(() => {
    resetRemoteRecordingPlaybackForTests();
    mockAuthenticatedFetch.mockReset();
  });

  it('AC-030 sweep: a present valid local recording plays successfully', async () => {
    const playedPaths: string[] = [];
    configureRemoteRecordingPlayback({
      fileExists: async path => path === LOCAL_PATH,
      playLocal: async path => {
        playedPaths.push(path);
      },
    });

    const result = await playSummarySentenceRecording({
      recordingId: 'rec-1',
      localFilePath: LOCAL_PATH,
      serverRecordingId: null,
    });

    expect(result).toEqual({ok: true});
    expect(playedPaths).toContain(LOCAL_PATH);
  });

  it('ADV-007 / AC-030 S1: a corrupt local recording falls back to its completed Server recording', async () => {
    const persistedPaths = new Set([LOCAL_PATH]);
    const playedPaths: string[] = [];
    mockAuthenticatedFetch.mockResolvedValue({
      ok: true,
      text: async () => 'audio-bytes',
    });
    configureRemoteRecordingPlayback({
      fileExists: async path => persistedPaths.has(path),
      writeFile: async path => {
        persistedPaths.add(path);
      },
      playLocal: async path => {
        if (path === LOCAL_PATH) {
          throw new Error('corrupt local audio');
        }
        playedPaths.push(path);
      },
    });

    await playSummarySentenceRecording({
      recordingId: 'rec-1',
      localFilePath: LOCAL_PATH,
      serverRecordingId: SERVER_RECORDING_ID,
    });

    expect(playedPaths).toContain(CACHE_PATH);
  });

  it('ADV-008 / AC-030 S1: a corrupt Server cache is refreshed from the completed Server recording', async () => {
    const persistedPaths = new Set([CACHE_PATH]);
    const playedPaths: string[] = [];
    let firstCachedPlay = true;
    mockAuthenticatedFetch.mockResolvedValue({
      ok: true,
      text: async () => 'fresh-audio-bytes',
    });
    configureRemoteRecordingPlayback({
      fileExists: async path => persistedPaths.has(path),
      writeFile: async path => {
        persistedPaths.add(path);
      },
      playLocal: async path => {
        if (path === CACHE_PATH && firstCachedPlay) {
          firstCachedPlay = false;
          throw new Error('corrupt cached audio');
        }
        playedPaths.push(path);
      },
    });

    await playSummarySentenceRecording({
      recordingId: 'rec-1',
      localFilePath: null,
      serverRecordingId: SERVER_RECORDING_ID,
    });

    expect(playedPaths).toContain(CACHE_PATH);
  });

  it('AC-030 sweep: network and cache-write failures do not play an unavailable source', async () => {
    const playedPaths: string[] = [];
    mockAuthenticatedFetch.mockRejectedValueOnce(new Error('offline'));
    configureRemoteRecordingPlayback({
      fileExists: async () => false,
      writeFile: async () => {
        throw new Error('disk full');
      },
      playLocal: async path => {
        playedPaths.push(path);
      },
    });
    const row = {
      recordingId: 'rec-1',
      localFilePath: null,
      serverRecordingId: SERVER_RECORDING_ID,
    };

    const networkResult = await playSummarySentenceRecording(row);
    mockAuthenticatedFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'audio-bytes',
    });
    const writeResult = await playSummarySentenceRecording(row);

    expect(networkResult).toEqual({ok: false});
    expect(writeResult).toEqual({ok: false});
    expect(playedPaths.length).toBeLessThanOrEqual(0);
  });

  it('AC-030 sweep: repeated play reuses a successful Server cache', async () => {
    const persistedPaths = new Set<string>();
    const playedPaths: string[] = [];
    mockAuthenticatedFetch.mockResolvedValue({
      ok: true,
      text: async () => 'audio-bytes',
    });
    configureRemoteRecordingPlayback({
      fileExists: async path => persistedPaths.has(path),
      writeFile: async path => {
        persistedPaths.add(path);
      },
      playLocal: async path => {
        playedPaths.push(path);
      },
    });
    const row = {
      recordingId: 'rec-1',
      localFilePath: null,
      serverRecordingId: SERVER_RECORDING_ID,
    };

    const first = await playSummarySentenceRecording(row);
    const second = await playSummarySentenceRecording(row);

    expect(first).toEqual({ok: true});
    expect(second).toEqual({ok: true});
    expect(playedPaths).toContain(CACHE_PATH);
  });

  it('AC-030 sweep: no local or completed Server recording produces no playback', async () => {
    const playedPaths: string[] = [];
    configureRemoteRecordingPlayback({
      fileExists: async () => false,
      playLocal: async path => {
        playedPaths.push(path);
      },
    });

    const result = await playSummarySentenceRecording({
      recordingId: 'rec-1',
      localFilePath: null,
      serverRecordingId: null,
    });

    expect(result).toEqual({ok: false});
    expect(playedPaths.length).toBeLessThanOrEqual(0);
  });
});
