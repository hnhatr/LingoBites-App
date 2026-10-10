import {listAudioAssetLocalPaths} from '@features/audio';
import {
  removeAllCachedSourcePhotos,
  sweepLessonMedia,
} from '@features/lesson/player';
import {
  clearSpeakingData,
  enqueueSpeakingAttemptTombstones,
  listAllSpeakingAttempts,
  listSpeakingRecordingFilePaths,
  queueDurableServerRecordingDelete,
  requestRecordingUploadDrain,
  sweepSpeakingRecordingsDirectory,
} from '@features/speaking';

import {getDatabase, withTransaction} from '@core/db/database';
import {clearAllLocalDatabaseRows} from '@core/db/localDataWipe';
import {
  defaultFileDeleter,
  deleteLocalFiles,
} from '@core/localData/localFileCleanup';
import type {FileDeleter, LocalDataDeletionResult} from '@core/localData/types';

type LocalDataDeletionOptions = {
  fileDeleter?: FileDeleter;
};

const CURRENT_ACCOUNT_ID_KEY = 'current_account_id';

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

function readCurrentAccountId(): string | null {
  const db = getDatabase();
  const row = db
    .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [
      CURRENT_ACCOUNT_ID_KEY,
    ])
    .rows?.item(0) as {value?: string} | undefined;
  return row?.value ?? null;
}

const RECORDINGS_DIRECTORY_SWEEP_FAILED = 'RECORDINGS_DIRECTORY_UNREADABLE';

/**
 * Removes speaking-room recordings, error events, and linked review items,
 * then deletes the referenced audio files from disk.
 */
export async function clearSpeakingLocalData(
  options: LocalDataDeletionOptions = {},
): Promise<LocalDataDeletionResult> {
  const fileDeleter = options.fileDeleter ?? defaultFileDeleter;
  const ownerUserId = readCurrentAccountId();
  const filePaths = listSpeakingRecordingFilePaths();

  try {
    withTransaction(getDatabase(), () => {
      if (ownerUserId) {
        queueDurableServerRecordingDelete({
          ownerUserId,
          enqueueAttemptTombstones: true,
        });
      }
      clearSpeakingData();
    });
  } catch {
    return buildResult({dbCleared: false, failedFilePaths: []});
  }

  requestRecordingUploadDrain();
  try {
    await sweepSpeakingRecordingsDirectory();
  } catch {
    return buildResult({
      dbCleared: true,
      failedFilePaths: [RECORDINGS_DIRECTORY_SWEEP_FAILED],
    });
  }
  const failedFilePaths = await deleteLocalFiles(filePaths, fileDeleter);
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
  const ownerUserId = readCurrentAccountId();
  const attemptsForTombstones = listAllSpeakingAttempts();
  const wipeRequestedAt = new Date().toISOString();

  try {
    await clearAllLocalDatabaseRows({
      afterWipe: () => {
        if (!ownerUserId) {
          return;
        }
        enqueueSpeakingAttemptTombstones(
          attemptsForTombstones,
          wipeRequestedAt,
        );
        queueDurableServerRecordingDelete({
          ownerUserId,
          enqueueAttemptTombstones: false,
          requestedAt: wipeRequestedAt,
        });
      },
    });
  } catch {
    return buildResult({dbCleared: false, failedFilePaths: []});
  }

  // The lesson rows are gone, so every stored lesson media dir is swept.
  try {
    await sweepLessonMedia();
  } catch {
    // Best-effort; unreferenced media is swept again on the next lesson open.
  }
  await removeAllCachedSourcePhotos();

  requestRecordingUploadDrain();
  try {
    await sweepSpeakingRecordingsDirectory();
  } catch {
    return buildResult({
      dbCleared: true,
      failedFilePaths: [RECORDINGS_DIRECTORY_SWEEP_FAILED],
    });
  }
  const failedFilePaths = await deleteLocalFiles(filePaths, fileDeleter);
  return buildResult({dbCleared: true, failedFilePaths});
}
