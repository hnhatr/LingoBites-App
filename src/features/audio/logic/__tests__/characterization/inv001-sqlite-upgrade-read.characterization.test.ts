import {open} from 'react-native-quick-sqlite';

import {DB_NAME} from '@core/db/constants';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {
  CHARACTERIZATION_INVARIANTS,
  simulateDatabaseProcessRestart,
} from '@test/support/characterization';

import {__resetMockDatabases} from '../../../../../../test-utils/sqliteMock';
import {insertAudioAssetRow} from '@test/support/audioAssetSeed';
import {
  getReadyAudioAsset,
} from '../../data/AudioAssetRepository';

const NOW = '2026-09-27T12:00:00.000Z';

/** quick-sqlite + sqliteMock harness only; real-INFRA evidence is in inv001-inv005-audio-cache-real-sqlite.characterization.test.ts */
describe(`${CHARACTERIZATION_INVARIANTS.INV_001} SQLite upgrade-read (audio cache, mock harness)`, () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    runMigrations(getDatabase());
  });

  it('keeps ready chapter audio metadata readable after restart and idempotent migrations', () => {
    insertAudioAssetRow({
      id: 'asset-char',
      chapterId: 'ch-char',
      url: 'https://cdn.example.com/asset-char.mp3',
      localPath: '/data/chapter-audio/asset-char.mp3',
      bytes: 4096,
      checksum: 'sha-char',
      downloadStatus: 'ready',
      updatedAt: NOW,
    });

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
