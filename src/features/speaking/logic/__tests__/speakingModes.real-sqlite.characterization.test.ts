import {open} from 'react-native-quick-sqlite';

import {DB_NAME} from '@core/db/constants';
import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {seedCanonicalLessonDownload} from '@test/support/canonicalDownloadSeed';

import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {getShadowingContent, listSpeakingRoomModes} from '../speakingModes';

function setupDb() {
  __resetMockDatabases();
  const db = open({name: DB_NAME});
  resetDatabaseForTests(db);
  runMigrations(db);
  return db;
}

describe('speakingModes real SQLite (TASK-008)', () => {
  beforeEach(() => setupDb());

  it('reports no shadowing content when lesson_downloads is empty', () => {
    expect(getShadowingContent()).toEqual([]);
    expect(
      listSpeakingRoomModes().find(m => m.mode === 'shadowing')?.available,
    ).toBe(false);
  });

  it('enables shadowing from downloaded canonical sentences', () => {
    seedCanonicalLessonDownload();
    const content = getShadowingContent();
    expect(content.length).toBeGreaterThan(0);
    expect(
      listSpeakingRoomModes().find(m => m.mode === 'shadowing')?.available,
    ).toBe(true);
  });
});
