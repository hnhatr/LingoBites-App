import {open} from 'react-native-quick-sqlite';

import {
  getYouTubeProgress,
  saveYouTubeProgress,
} from '@features/youtube/logic/data/YouTubeProgressRepository';

import {DB_NAME} from '@core/db/constants';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';

import {CHARACTERIZATION_INVARIANTS} from '@test/support/characterization';

import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';

describe(`${CHARACTERIZATION_INVARIANTS.INV_003} account isolation`, () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    getDatabase();
  });

  it('does not leak learner cache rows after an account switch wipe', () => {
    saveYouTubeProgress({
      lessonId: 'lesson-user-a',
      positionMs: 5000,
      segmentIndex: 2,
    });
    expect(getYouTubeProgress('lesson-user-a')).not.toBeNull();

    __resetMockDatabases();
    resetDatabaseForTests();

    expect(getYouTubeProgress('lesson-user-a')).toBeNull();
  });
});
