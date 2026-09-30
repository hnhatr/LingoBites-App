import {open} from 'react-native-quick-sqlite';

import {DB_NAME} from '@core/db/constants';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {
  CHARACTERIZATION_INVARIANTS,
  simulateDatabaseProcessRestart,
} from '@test/support/characterization';

import {__resetMockDatabases} from '../../../../../../test-utils/sqliteMock';
import {
  insertSpeakingRecording,
  listSpeakingRecordings,
} from '../../data/SpeakingRepository';

const NOW = '2026-09-27T12:00:00.000Z';

/** quick-sqlite + sqliteMock harness only; real-INFRA evidence is in inv001-inv005-speaking-recordings-real-sqlite.characterization.test.ts */
describe(`${CHARACTERIZATION_INVARIANTS.INV_001} SQLite upgrade-read (speaking recordings, mock harness)`, () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    runMigrations(getDatabase());
  });

  it('keeps speaking recording metadata readable after restart and idempotent migrations', () => {
    insertSpeakingRecording({
      id: 'rec-char',
      mode: 'shadowing',
      filePath: '/files/rec-char.m4a',
      durationMs: 1200,
      createdAt: NOW,
    });

    simulateDatabaseProcessRestart();
    expect(listSpeakingRecordings()).toHaveLength(1);

    runMigrations(getDatabase());
    expect(listSpeakingRecordings()[0]).toMatchObject({
      id: 'rec-char',
      filePath: '/files/rec-char.m4a',
      mode: 'shadowing',
    });
  });
});
