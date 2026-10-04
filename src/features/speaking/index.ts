export {
  captureErrorEvent,
  insertSpeakingRecording,
  listErrorEvents,
  listSpeakingRecordings,
} from './logic/speakingQueryPort';
export {
  createRecordingMetadata,
  uploadRecordingBinary,
} from './logic/api/recordingClient';
export type {
  CreateRecordingResult,
  RecordingClientOptions,
  UploadBinaryResult,
} from './logic/api/recordingClient';
export {listAllSpeakingAttempts} from './logic/data/SpeakingAttemptRepository';
export {
  clearSpeakingData,
  listSpeakingRecordingFilePaths,
} from './logic/data/SpeakingRepository';

export async function listSpeakingRecordingsDirectoryFilePaths(): Promise<
  string[]
> {
  try {
    const {listRecordingsDirectoryFilePaths} =
      require('./logic/recordingService') as typeof import('./logic/recordingService');
    return listRecordingsDirectoryFilePaths();
  } catch {
    return [];
  }
}

export async function sweepSpeakingRecordingsDirectory(): Promise<void> {
  try {
    const {sweepRecordingsDirectory} =
      require('./logic/recordingService') as typeof import('./logic/recordingService');
    await sweepRecordingsDirectory();
  } catch {
    // Native FS module unavailable (e.g. Jest without mocks).
  }
}
export {saveShadowingAttempt} from './logic/shadowing/saveShadowingAttempt';
export {
  initRecordingUploadQueue,
  requestRecordingUploadDrain,
} from './logic/upload/recordingUploadQueue';
export {
  enqueueSpeakingAttemptTombstones,
  queueDurableServerRecordingDelete,
  queueAccountOnlyServerRecordingDelete,
} from './logic/upload/serverRecordingDeletion';
export {
  isRecordingUploadConsentOn,
  readRecordingUploadConsent,
} from './logic/upload/recordingConsent';
export type {
  SaveShadowingAttemptInput,
  SaveShadowingAttemptResult,
} from './logic/shadowing/saveShadowingAttempt';
export type {
  SpeakingRoomRouteParams,
  SpeakingShadowingRouteParams,
} from './screens/navigationTypes';
