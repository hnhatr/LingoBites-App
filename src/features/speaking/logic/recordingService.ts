/**
 * On-device mic recording + playback for the Speaking Room (SETE-110 / M5,
 * REQ-20/21).
 *
 * Follows the same "native adapter degrades gracefully" convention as
 * `features/audio/logic/deviceChapterAudio.ts`: every function returns an explicit
 * `{ok:false, errorCode}` result instead of throwing when the native
 * recorder module or file system is unavailable (e.g. on a bare simulator
 * without the native module linked), so the Speaking Room UI can show a
 * clear message rather than crash.
 *
 * Recording is always explicit: `startRecording` only ever runs because the
 * learner tapped a record button in the UI — there is no background/silent
 * recording path anywhere in this module (REQ-20).
 */

import * as RNFS from '@dr.pogodin/react-native-fs';
import {Platform} from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import {check, PERMISSIONS, request, RESULTS} from 'react-native-permissions';

import type {SpeakingMode} from '@core/db/types';

function nativeFsAvailable(): boolean {
  return (
    typeof RNFS.DocumentDirectoryPath === 'string' &&
    RNFS.DocumentDirectoryPath.length > 0
  );
}

function recordingsRoot(): string {
  return `${RNFS.DocumentDirectoryPath}/LingoBitesRecordings`;
}

async function ensureDirectory(directory: string): Promise<void> {
  try {
    await RNFS.mkdir(directory);
  } catch {
    // Directory usually already exists; a real storage error surfaces on write.
  }
}

/** Keeps a recording id safe to use as a file system segment. */
export function sanitizeRecordingSegment(segment: string): string {
  const cleaned = segment
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'recording';
}

let recorder: AudioRecorderPlayer | null = null;

export async function preflightMicrophonePermission(): Promise<
  'granted' | 'denied' | 'not_requested' | 'unavailable'
> {
  const permission =
    Platform.OS === 'ios'
      ? PERMISSIONS.IOS.MICROPHONE
      : PERMISSIONS.ANDROID.RECORD_AUDIO;

  const status = await check(permission);
  if (status === RESULTS.UNAVAILABLE) return 'unavailable';
  if (status === RESULTS.GRANTED) return 'granted';
  if (status === RESULTS.DENIED) return 'not_requested';
  return 'denied';
}

export async function requestMicrophonePermission(): Promise<
  'granted' | 'denied' | 'unavailable'
> {
  const permission =
    Platform.OS === 'ios'
      ? PERMISSIONS.IOS.MICROPHONE
      : PERMISSIONS.ANDROID.RECORD_AUDIO;

  const status = await request(permission);
  if (status === RESULTS.UNAVAILABLE) return 'unavailable';
  if (status === RESULTS.GRANTED) return 'granted';
  return 'denied';
}

function getRecorder(): AudioRecorderPlayer {
  if (!recorder) {
    recorder = new AudioRecorderPlayer();
  }
  return recorder;
}

export type StartRecordingResult =
  | {ok: true; filePath: string}
  | {
      ok: false;
      errorCode:
        | 'UNAVAILABLE'
        | 'PERMISSION_DENIED'
        | 'NO_INPUT_DEVICE'
        | 'TRANSIENT_FAILURE';
      message: string;
    };

/**
 * Starts recording to a new file under the app's documents directory.
 * Must only be called from an explicit user tap on a record button (REQ-20).
 */
export async function startRecording(
  mode: SpeakingMode,
  recordingId: string,
): Promise<StartRecordingResult> {
  if (!nativeFsAvailable()) {
    return {
      ok: false,
      errorCode: 'UNAVAILABLE',
      message: 'Tính năng ghi âm chưa sẵn sàng trên thiết bị này.',
    };
  }

  const perm = await preflightMicrophonePermission();
  if (perm === 'unavailable') {
    return {
      ok: false,
      errorCode: 'NO_INPUT_DEVICE',
      message: 'Không tìm thấy micro trên thiết bị này.',
    };
  }
  if (perm === 'not_requested') {
    const requested = await requestMicrophonePermission();
    if (requested !== 'granted') {
      return {
        ok: false,
        errorCode: 'PERMISSION_DENIED',
        message: 'LingoBites cần micro để ghi âm phần luyện nói của bạn.',
      };
    }
  } else if (perm === 'denied') {
    return {
      ok: false,
      errorCode: 'PERMISSION_DENIED',
      message: 'LingoBites cần micro để ghi âm phần luyện nói của bạn.',
    };
  }

  const directory = `${recordingsRoot()}/${sanitizeRecordingSegment(mode)}`;
  await ensureDirectory(directory);
  const filePath = `${directory}/${sanitizeRecordingSegment(recordingId)}.m4a`;

  try {
    await getRecorder().startRecorder(filePath);
    return {ok: true, filePath};
  } catch {
    return {
      ok: false,
      errorCode: 'TRANSIENT_FAILURE',
      message: 'Không thể bắt đầu ghi âm. Vui lòng thử lại.',
    };
  }
}

export type StopRecordingResult =
  | {ok: true; filePath: string; durationMs: number}
  | {ok: false; errorCode: 'UNAVAILABLE'; message: string};

/** Stops the in-progress recording started by `startRecording`. */
export async function stopRecording(
  filePath: string,
  startedAtMs: number,
): Promise<StopRecordingResult> {
  try {
    const resultPath = await getRecorder().stopRecorder();
    getRecorder().removeRecordBackListener();
    return {
      ok: true,
      filePath: resultPath || filePath,
      durationMs: Math.max(0, Date.now() - startedAtMs),
    };
  } catch {
    return {
      ok: false,
      errorCode: 'UNAVAILABLE',
      message: 'Không thể dừng ghi âm.',
    };
  }
}

export type PlaybackResult =
  | {ok: true}
  | {ok: false; errorCode: 'UNAVAILABLE' | 'NOT_FOUND'; message: string};

/** Plays back a recorded (or reference) audio file from local disk. */
export async function playRecording(filePath: string): Promise<PlaybackResult> {
  if (nativeFsAvailable()) {
    let exists = false;
    try {
      exists = await RNFS.exists(filePath);
    } catch {
      exists = false;
    }
    if (!exists) {
      return {
        ok: false,
        errorCode: 'NOT_FOUND',
        message: 'Không tìm thấy tệp ghi âm.',
      };
    }
  }
  try {
    await getRecorder().startPlayer(filePath);
    return {ok: true};
  } catch {
    return {
      ok: false,
      errorCode: 'UNAVAILABLE',
      message: 'Không thể phát lại bản ghi âm.',
    };
  }
}

/** Stops any in-progress playback started by `playRecording`. */
export async function stopPlayback(): Promise<void> {
  try {
    await getRecorder().stopPlayer();
    getRecorder().removePlayBackListener();
  } catch {
    // Best-effort: nothing to stop, or the native module is unavailable.
  }
}

/** Best-effort deletion of a recording file from local disk. */
export async function deleteRecordingFile(filePath: string): Promise<void> {
  if (!nativeFsAvailable()) {
    return;
  }
  try {
    await RNFS.unlink(filePath);
  } catch {
    // A missing file is already the desired state.
  }
}
