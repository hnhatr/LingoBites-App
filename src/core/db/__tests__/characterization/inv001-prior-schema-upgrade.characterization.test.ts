import {open} from 'react-native-quick-sqlite';
import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {DB_NAME} from '../../constants';
import {getDatabase, resetDatabaseForTests} from '../../database';
import {
  downgradeYouTubeProgressMigrations,
  runMigrations,
} from '../../migrations';
import {
  getYouTubeProgress,
  saveYouTubeProgress,
} from '@features/youtube/logic/data/YouTubeProgressRepository';
import {CHARACTERIZATION_INVARIANTS} from '@test/support/characterization/index';
import {simulateDatabaseProcessRestart} from '@test/support/characterization/index';

/** SETE-290 initial DDL before revision/tombstone columns (mock quick-sqlite). */
const PRIOR_YOUTUBE_PROGRESS_DDL = `CREATE TABLE IF NOT EXISTS youtube_progress (
  lesson_id TEXT PRIMARY KEY NOT NULL,
  position_ms INTEGER NOT NULL,
  segment_index INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);`;

describe(`${CHARACTERIZATION_INVARIANTS.INV_001} prior-schema upgrade (HC-006, mock DB)`, () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    getDatabase();
  });

  it('seeds prior youtube_progress schema, upgrades via runMigrations, keeps learner row after restart', () => {
    const db = getDatabase();
    runMigrations(db);
    downgradeYouTubeProgressMigrations(db);

    db.execute(PRIOR_YOUTUBE_PROGRESS_DDL);
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
