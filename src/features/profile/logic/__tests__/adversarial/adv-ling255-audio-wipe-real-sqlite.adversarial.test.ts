import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

jest.mock('@features/speaking/logic/recordingService', () => ({
  listRecordingsDirectoryFilePaths: jest.fn().mockResolvedValue([]),
  sweepRecordingsDirectory: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@features/speaking/logic/upload/recordingUploadQueue', () => ({
  requestRecordingUploadDrain: jest.fn(),
  initRecordingUploadQueue: jest.fn(),
}));

import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';
import {insertAudioAssetRow} from '@test/support/audioAssetSeed';

import {clearAllLocalDataWithFiles} from '../../LocalDataDeletionService';

const ACCOUNT_ID = '44444444-4444-4444-8444-444444444444';
const NOW = '2026-10-04T10:00:00.000Z';

let db: RealSqliteConnection;
let tempDir: string;

function seedLegacyAudioFile(): string {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ling255-audio-wipe-'));
  const audioPath = path.join(tempDir, 'legacy-chapter.mp3');
  fs.writeFileSync(audioPath, 'LEGACY-CHAPTER-AUDIO');
  insertAudioAssetRow({
    id: 'legacy-audio-1',
    chapterId: 'legacy-chapter-1',
    url: 'https://cdn.example.test/legacy-chapter.mp3',
    localPath: audioPath,
    bytes: fs.statSync(audioPath).size,
    checksum: 'sha256:legacy-audio-1',
    downloadStatus: 'ready',
    updatedAt: NOW,
  });
  return audioPath;
}

function countAudioRows(): number {
  const row = getDatabase()
    .execute('SELECT COUNT(*) AS count FROM audio_assets;')
    .rows?.item(0) as {count: number};
  return Number(row.count);
}

function readCurrentAccountId(): string | null {
  const row = getDatabase()
    .execute(
      "SELECT value FROM app_settings WHERE key = 'current_account_id' LIMIT 1;",
    )
    .rows?.item(0) as {value?: string} | undefined;
  return row?.value ?? null;
}

beforeEach(() => {
  db = openRealSqlite(':memory:');
  runMigrations(db);
  resetDatabaseForTests(db);
  tempDir = '';
  db.execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    ['current_account_id', ACCOUNT_ID, NOW],
  );
});

afterEach(() => {
  db.close();
  resetDatabaseForTests(null);
  if (tempDir) {
    fs.rmSync(tempDir, {recursive: true, force: true});
  }
});

describe('LING-255 delete-my-data audio reliability (real SQLite)', () => {
  it('INV-002 / H2: removes a legacy audio row and its managed file', async () => {
    const audioPath = seedLegacyAudioFile();

    const result = await clearAllLocalDataWithFiles({
      fileDeleter: async filePath => {
        fs.unlinkSync(filePath);
        return true;
      },
    });

    expect(result).toEqual({
      ok: true,
      dbCleared: true,
      failedFilePaths: [],
    });
    expect(countAudioRows()).toBeLessThanOrEqual(0);
    expect(fs.existsSync(audioPath)).toBe(false);
    expect(readCurrentAccountId()).toBe(ACCOUNT_ID);
  });

  it('INV-002 / H5: keeps SQLite readable while managed-file deletion is pending', async () => {
    const audioPath = seedLegacyAudioFile();
    let releaseFileDelete!: () => void;
    let reportFileDeleteStarted!: () => void;
    const fileDeleteStarted = new Promise<void>(resolve => {
      reportFileDeleteStarted = resolve;
    });
    const allowFileDelete = new Promise<void>(resolve => {
      releaseFileDelete = resolve;
    });

    const deletion = clearAllLocalDataWithFiles({
      fileDeleter: async filePath => {
        reportFileDeleteStarted();
        await allowFileDelete;
        fs.unlinkSync(filePath);
        return true;
      },
    });

    await fileDeleteStarted;
    expect(countAudioRows()).toBeLessThanOrEqual(0);
    expect(readCurrentAccountId()).toBe(ACCOUNT_ID);
    expect(
      (
        getDatabase().execute('PRAGMA integrity_check;').rows?.item(0) as {
          integrity_check: string;
        }
      ).integrity_check,
    ).toBe('ok');

    releaseFileDelete();
    await expect(deletion).resolves.toEqual({
      ok: true,
      dbCleared: true,
      failedFilePaths: [],
    });
    expect(fs.existsSync(audioPath)).toBe(false);
  });
});
