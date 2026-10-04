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

const orphan: ReadDirResItemT = {
  ctime: new Date(NOW),
  mtime: new Date(NOW),
  name: 'untracked.m4a',
  path: ORPHAN_PATH,
  size: 123,
  isDirectory: () => false,
  isFile: () => true,
};

type Wipe = (options: {
  fileDeleter: (path: string) => Promise<boolean>;
}) => Promise<{ok: boolean}>;

const wipeEntryPaths: Array<[string, Wipe]> = [
  ['full wipe', clearAllLocalDataWithFiles],
  ['speaking-only wipe', clearSpeakingLocalData],
];

let db: RealSqliteConnection;

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

describe.each(wipeEntryPaths)(
  'INV-004 / AC-5 failure matrix: %s',
  (_, wipe) => {
    it.each([
      ['ENOENT', 'ENOENT: no such file or directory', true],
      ['EACCES', 'EACCES: permission denied', false],
      ['EIO', 'EIO: input/output error', false],
    ])(
      'readDir %s (%s) produces expected ok=%s',
      async (_code, message, expectedOk) => {
        jest.mocked(RNFS.readDir).mockRejectedValue(new Error(message));

        const result = await wipe({fileDeleter: async () => true});

        expect(result.ok).toBe(expectedOk);
      },
    );

    it.each([
      ['ENOENT', 'ENOENT: no such file or directory', true],
      ['EACCES', 'EACCES: permission denied', false],
      ['EIO', 'EIO: input/output error', false],
    ])(
      'unlink %s (%s) produces expected ok=%s',
      async (_code, message, expectedOk) => {
        jest.mocked(RNFS.readDir).mockResolvedValue([orphan]);
        jest.mocked(RNFS.unlink).mockRejectedValue(new Error(message));

        const result = await wipe({fileDeleter: async () => true});

        expect(RNFS.unlink).toHaveBeenCalledWith(ORPHAN_PATH);
        expect(result.ok).toBe(expectedOk);
      },
    );
  },
);
