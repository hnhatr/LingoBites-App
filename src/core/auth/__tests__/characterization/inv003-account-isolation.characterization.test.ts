import {open} from 'react-native-quick-sqlite';

import {DB_NAME} from '@core/db/constants';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';

import {
  DEFAULT_CANONICAL_LESSON_ID,
  readSeededLessonDownload,
  seedCanonicalLessonDownload,
} from '@test/support/canonicalDownloadSeed';
import {CHARACTERIZATION_INVARIANTS} from '@test/support/characterization';

import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';

describe(`${CHARACTERIZATION_INVARIANTS.INV_003} account isolation`, () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    getDatabase();
  });

  it('does not leak learner cache rows after an account switch wipe', () => {
    seedCanonicalLessonDownload();
    expect(
      readSeededLessonDownload(DEFAULT_CANONICAL_LESSON_ID),
    ).not.toBeNull();

    __resetMockDatabases();
    resetDatabaseForTests();

    expect(readSeededLessonDownload(DEFAULT_CANONICAL_LESSON_ID)).toBeNull();
  });
});
