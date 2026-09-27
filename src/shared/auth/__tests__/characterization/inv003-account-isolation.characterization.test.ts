import {open} from 'react-native-quick-sqlite';
import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {DB_NAME} from '@shared/db/constants';
import {getDatabase, resetDatabaseForTests} from '@shared/db/database';
import {
  saveYouTubeProgress,
  getYouTubeProgress,
} from '@shared/db/YouTubeProgressRepository';
import {CHARACTERIZATION_INVARIANTS} from '@/test-support/characterization';

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
