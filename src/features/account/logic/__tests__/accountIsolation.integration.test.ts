import {resetDatabaseForTests} from '@core/db/database';

import {
  DEFAULT_CANONICAL_LESSON_ID,
  readSeededLessonDownload,
  seedCanonicalLessonDownload,
} from '@test/support/canonicalDownloadSeed';

import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';

describe('cross-account cache isolation', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests();
  });

  it('switch account → wipe → no leakage', () => {
    seedCanonicalLessonDownload();
    expect(readSeededLessonDownload(DEFAULT_CANONICAL_LESSON_ID)).toBeTruthy();

    __resetMockDatabases();
    resetDatabaseForTests();

    expect(readSeededLessonDownload(DEFAULT_CANONICAL_LESSON_ID)).toBeNull();
  });
});
