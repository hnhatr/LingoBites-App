import {open} from 'react-native-quick-sqlite';
import {__resetMockDatabases} from '../../../../../../../test-utils/sqliteMock';
import {DB_NAME} from '@core/db/constants';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {
  getActivePackage,
  insertPackageRecord,
  swapActivePackage,
} from '../ContentPackageRepository';
import {
  getContentLessonState,
  saveContentLesson,
  startContentLesson,
} from '../ContentLessonStateRepository';
import {CHARACTERIZATION_INVARIANTS} from '@/test-support/characterization';

const NOW = '2026-09-27T12:00:00.000Z';

describe(`${CHARACTERIZATION_INVARIANTS.INV_005} content and progress upsert`, () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    runMigrations(getDatabase());
  });

  it('keeps a single active content package and idempotent lesson progress upserts', () => {
    insertPackageRecord({
      id: 'pkg-a',
      slug: 'v1',
      schemaVersion: '0.1.0',
      sourceUrl: 'https://example.com/v1.zip',
      sha256: 'a',
      importedAt: NOW,
      isActive: true,
    });
    insertPackageRecord({
      id: 'pkg-b',
      slug: 'v2',
      schemaVersion: '0.1.0',
      sourceUrl: 'https://example.com/v2.zip',
      sha256: 'b',
      importedAt: NOW,
      isActive: false,
    });
    swapActivePackage('pkg-b', NOW);
    expect(getActivePackage()?.id).toBe('pkg-b');

    const firstSave = saveContentLesson({
      lessonId: 'lesson-content-1',
      now: NOW,
    });
    const secondSave = saveContentLesson({
      lessonId: 'lesson-content-1',
      now: NOW,
    });
    expect(firstSave.ok && firstSave.duplicate).toBe(false);
    expect(secondSave.ok && secondSave.duplicate).toBe(true);

    startContentLesson({lessonId: 'lesson-content-1', now: NOW});
    const state = getContentLessonState('lesson-content-1');
    expect(state).toMatchObject({
      lessonId: 'lesson-content-1',
      isSaved: true,
      isStarted: true,
    });
  });
});
