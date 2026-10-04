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
  let listRecordingsDirectoryFilePaths: () => Promise<string[]>;
  try {
    ({listRecordingsDirectoryFilePaths} =
      require('./logic/recordingService') as typeof import('./logic/recordingService'));
  } catch {
    return [];
  }
  return listRecordingsDirectoryFilePaths();
}

export async function sweepSpeakingRecordingsDirectory(): Promise<void> {
  let sweepRecordingsDirectory: () => Promise<void>;
  try {
    ({sweepRecordingsDirectory} =
      require('./logic/recordingService') as typeof import('./logic/recordingService'));
  } catch {
    return;
  }
  await sweepRecordingsDirectory();
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
export {
  findMostRecentInProgressShadowingLesson,
  listShadowingLessonProgressSummaries,
  resolveShadowingEntry,
  summarizeShadowingLessonProgress,
} from './logic/shadowing/shadowingProgress';
export type {
  ShadowingEntryTarget,
  ShadowingLessonProgressSummary,
  ShadowingLessonStatusChip,
} from './logic/shadowing/shadowingProgress';
export type {
  ShadowingLessonPickerRouteParams,
  ShadowingSessionRouteParams,
  SpeakingRoomRouteParams,
  SpeakingShadowingRouteParams,
} from './screens/navigationTypes';
