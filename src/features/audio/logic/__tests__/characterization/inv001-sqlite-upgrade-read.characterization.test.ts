import {open} from 'react-native-quick-sqlite';
import {__resetMockDatabases} from '../../../../../../test-utils/sqliteMock';
import {DB_NAME} from '@core/db/constants';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {
  getReadyAudioAsset,
  insertPendingChapterAudioAsset,
  markChapterAudioAssetReady,
} from '../../data/AudioAssetRepository';
import {
  CHARACTERIZATION_INVARIANTS,
  simulateDatabaseProcessRestart,
} from '@test/support/characterization/index';

const NOW = '2026-09-27T12:00:00.000Z';

/** quick-sqlite + sqliteMock harness only; real-INFRA evidence is in inv001-inv005-audio-cache-real-sqlite.characterization.test.ts */
describe(`${CHARACTERIZATION_INVARIANTS.INV_001} SQLite upgrade-read (audio cache, mock harness)`, () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    runMigrations(getDatabase());
  });

  it('keeps ready chapter audio metadata readable after restart and idempotent migrations', () => {
    insertPendingChapterAudioAsset({
      chapterId: 'ch-char',
      asset: {
        id: 'asset-char',
        url: 'https://cdn.example.com/asset-char.mp3',
        bytes: 0,
        checksum: 'sha-char',
      },
      now: NOW,
    });
    markChapterAudioAssetReady(
      'asset-char',
      '/data/chapter-audio/asset-char.mp3',
      4096,
      NOW,
    );

    simulateDatabaseProcessRestart();
    expect(getReadyAudioAsset('asset-char')?.localPath).toBe(
      '/data/chapter-audio/asset-char.mp3',
    );

    runMigrations(getDatabase());
    expect(getReadyAudioAsset('asset-char')).toMatchObject({
      id: 'asset-char',
      chapterId: 'ch-char',
      downloadStatus: 'ready',
      bytes: 4096,
    });
  });
});
