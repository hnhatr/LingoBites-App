import {open} from 'react-native-quick-sqlite';
import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {DB_NAME} from '../../constants';
import {getDatabase, resetDatabaseForTests} from '../../database';
import {runMigrations} from '../../migrations';
import {
  getYouTubeProgress,
  saveYouTubeProgress,
} from '../../YouTubeProgressRepository';
import {CHARACTERIZATION_INVARIANTS} from '@/test-support/characterization';
import {simulateDatabaseProcessRestart} from '@/test-support/characterization';

describe(`${CHARACTERIZATION_INVARIANTS.INV_001} prior-schema upgrade (HC-006, mock DB)`, () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    getDatabase();
  });

  it('keeps seeded learner progress readable across production migration re-run (upgrade pass)', () => {
    const db = getDatabase();
    runMigrations(db);
    saveYouTubeProgress({
      lessonId: 'legacy-lesson',
      positionMs: 4500,
      segmentIndex: 2,
    });

    runMigrations(db);
    simulateDatabaseProcessRestart();

    expect(getYouTubeProgress('legacy-lesson')).toMatchObject({
      lessonId: 'legacy-lesson',
      positionMs: 4500,
      segmentIndex: 2,
    });
  });
});
