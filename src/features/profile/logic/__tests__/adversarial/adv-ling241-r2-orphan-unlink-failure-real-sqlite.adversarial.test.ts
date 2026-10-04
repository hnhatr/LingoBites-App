import type {ReadDirResItemT} from '@dr.pogodin/react-native-fs';
import * as RNFS from '@dr.pogodin/react-native-fs';

jest.mock('@features/speaking/logic/upload/recordingUploadQueue', () => ({
  requestRecordingUploadDrain: jest.fn(),
  initRecordingUploadQueue: jest.fn(),
}));

import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

import {
  clearAllLocalDataWithFiles,
  clearSpeakingLocalData,
} from '../../LocalDataDeletionService';

const OWNER_ID = '44444444-4444-4444-8444-444444444444';
const NOW = '2026-10-04T10:00:00.000Z';
const ORPHAN_PATH =
  '/mock/Documents/LingoBitesRecordings/shadowing/untracked.m4a';

let db: RealSqliteConnection;

function rejectOrphanUnlink(): void {
  const orphan: ReadDirResItemT = {
    ctime: new Date(NOW),
    mtime: new Date(NOW),
    name: 'untracked.m4a',
    path: ORPHAN_PATH,
    size: 123,
    isDirectory: () => false,
    isFile: () => true,
  };
  jest.mocked(RNFS.readDir).mockResolvedValue([orphan]);
  jest
    .mocked(RNFS.unlink)
    .mockRejectedValue(new Error('EACCES: unlink permission denied'));
}

beforeEach(() => {
  db = openRealSqlite(':memory:');
  runMigrations(db);
  resetDatabaseForTests(db);
  db.execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    ['current_account_id', OWNER_ID, NOW],
  );
  jest.clearAllMocks();
});

afterEach(() => {
  db.close();
  resetDatabaseForTests(null);
});

it('ADV-005 / INV-004 / AC-5: an orphan unlink failure is not acknowledged as a successful sweep', async () => {
  rejectOrphanUnlink();

  const result = await clearAllLocalDataWithFiles({
    fileDeleter: async () => true,
  });

  expect(RNFS.unlink).toHaveBeenCalledWith(ORPHAN_PATH);
  expect(result.ok).toBe(false);
});

it('ADV-006 / INV-004 / AC-5: speaking-only wipe reports an orphan unlink failure', async () => {
  rejectOrphanUnlink();

  const result = await clearSpeakingLocalData({
    fileDeleter: async () => true,
  });

  expect(RNFS.unlink).toHaveBeenCalledWith(ORPHAN_PATH);
  expect(result.ok).toBe(false);
});
