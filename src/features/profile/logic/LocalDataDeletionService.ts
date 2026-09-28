import {listAudioAssetLocalPaths} from '@features/audio';
import {clearAllLocalDatabaseRows} from '@shared/db/localDataWipe';
import {
  clearSpeakingData,
  listSpeakingRecordingFilePaths,
} from '@features/speaking';
import {
  defaultFileDeleter,
  deleteLocalFiles,
} from '../../../shared/localData/localFileCleanup';
import type {
  FileDeleter,
  LocalDataDeletionResult,
} from '../../../shared/localData/types';

type LocalDataDeletionOptions = {
  fileDeleter?: FileDeleter;
};

function buildResult({
  dbCleared,
  failedFilePaths,
}: {
  dbCleared: boolean;
  failedFilePaths: string[];
}): LocalDataDeletionResult {
  return {
    ok: dbCleared && failedFilePaths.length === 0,
    dbCleared,
    failedFilePaths,
  };
}

/**
 * Removes speaking-room recordings, error events, and linked review items,
 * then deletes the referenced audio files from disk.
 */
export async function clearSpeakingLocalData(
  options: LocalDataDeletionOptions = {},
): Promise<LocalDataDeletionResult> {
  const fileDeleter = options.fileDeleter ?? defaultFileDeleter;
  const {deletedFilePaths} = clearSpeakingData();
  const failedFilePaths = await deleteLocalFiles(deletedFilePaths, fileDeleter);
  return buildResult({dbCleared: true, failedFilePaths});
}

/**
 * Clears all learner-owned local database rows, then removes managed
 * recording and cached chapter-audio files collected before metadata deletion.
 */
export async function clearAllLocalDataWithFiles(
  options: LocalDataDeletionOptions = {},
): Promise<LocalDataDeletionResult> {
  const fileDeleter = options.fileDeleter ?? defaultFileDeleter;
  const recordingFilePaths = listSpeakingRecordingFilePaths();
  const audioFilePaths = listAudioAssetLocalPaths();
  const filePaths = [...recordingFilePaths, ...audioFilePaths];

  try {
    await clearAllLocalDatabaseRows();
  } catch {
    return buildResult({dbCleared: false, failedFilePaths: []});
  }

  const failedFilePaths = await deleteLocalFiles(filePaths, fileDeleter);
  return buildResult({dbCleared: true, failedFilePaths});
}
