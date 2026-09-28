import {open} from 'react-native-quick-sqlite';
import {__resetMockDatabases} from '../../../../../../../test-utils/sqliteMock';
import {DB_NAME} from '@core/db/constants';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {
  getContentLessonState,
  saveContentLesson,
  startContentLesson,
} from '@features/lesson/packages/logic/data/ContentLessonStateRepository';
import {
  CHARACTERIZATION_INVARIANTS,
  simulateDatabaseProcessRestart,
} from '@test/support/characterization/index';

const NOW = '2026-09-27T12:00:00.000Z';

/** quick-sqlite + sqliteMock harness only; real-INFRA evidence is in inv001-inv005-catalog-progress-real-sqlite.characterization.test.ts */
describe(`${CHARACTERIZATION_INVARIANTS.INV_001} SQLite upgrade-read (curriculumLesson, mock harness)`, () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    runMigrations(getDatabase());
  });

  it('keeps persisted lesson catalog state readable after restart and idempotent migrations', () => {
    saveContentLesson({lessonId: 'lesson-char', now: NOW});
    startContentLesson({lessonId: 'lesson-char', now: NOW});

    simulateDatabaseProcessRestart();
    expect(getContentLessonState('lesson-char')?.isStarted).toBe(true);

    runMigrations(getDatabase());
    expect(getContentLessonState('lesson-char')).toMatchObject({
      lessonId: 'lesson-char',
      isStarted: true,
      tombstone: false,
    });
  });
});
