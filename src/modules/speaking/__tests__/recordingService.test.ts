/**
 * Tests for the Speaking Room recording adapter (SETE-110 / M5).
 *
 * Pins graceful degradation when native modules are unavailable, and that a
 * normal start/stop/play/delete cycle resolves paths under the app's local
 * documents directory (never a network location).
 */

import * as RNFS from '@dr.pogodin/react-native-fs';

jest.mock('react-native-permissions', () => ({
  check: jest.fn().mockResolvedValue('granted'),
  request: jest.fn().mockResolvedValue('granted'),
  PERMISSIONS: {
    IOS: {MICROPHONE: 'ios.permission.MICROPHONE'},
    ANDROID: {RECORD_AUDIO: 'android.permission.RECORD_AUDIO'},
  },
  RESULTS: {UNAVAILABLE: 'unavailable', GRANTED: 'granted', DENIED: 'denied'},
}));

import {
  deleteRecordingFile,
  playRecording,
  startRecording,
  stopPlayback,
  stopRecording,
} from '../recordingService';

describe('recordingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts a recording under the local documents directory when native FS is available', async () => {
    const result = await startRecording('shadowing', 'rec-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.filePath).toContain(
        '/mock/Documents/LingoBitesRecordings/shadowing/rec-1.m4a',
      );
    }
  });

  it('stops a recording and returns a duration', async () => {
    const start = await startRecording('shadowing', 'rec-1');
    expect(start.ok).toBe(true);
    const startedAtMs = Date.now() - 1500;
    const stop = await stopRecording(
      (start as {filePath: string}).filePath,
      startedAtMs,
    );
    expect(stop.ok).toBe(true);
    if (stop.ok) {
      expect(stop.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('plays back an existing recording', async () => {
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    const result = await playRecording(
      '/mock/Documents/LingoBitesRecordings/shadowing/rec-1.m4a',
    );
    expect(result.ok).toBe(true);
  });

  it('reports NOT_FOUND when the file no longer exists on disk', async () => {
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    const result = await playRecording(
      '/mock/Documents/LingoBitesRecordings/shadowing/missing.m4a',
    );
    expect(result).toEqual({
      ok: false,
      errorCode: 'NOT_FOUND',
      message: expect.any(String),
    });
  });

  it('degrades to UNAVAILABLE when native FS is not linked', async () => {
    const original = RNFS.DocumentDirectoryPath;
    // @ts-expect-error test override of a readonly-looking module field
    RNFS.DocumentDirectoryPath = '';
    const result = await startRecording('shadowing', 'rec-1');
    expect(result).toEqual({
      ok: false,
      errorCode: 'UNAVAILABLE',
      message: expect.any(String),
    });
    // @ts-expect-error restoring the mocked module field
    RNFS.DocumentDirectoryPath = original;
  });

  it('stopPlayback and deleteRecordingFile never throw', async () => {
    await expect(stopPlayback()).resolves.toBeUndefined();
    await expect(
      deleteRecordingFile('/mock/Documents/x.m4a'),
    ).resolves.toBeUndefined();
  });
});
