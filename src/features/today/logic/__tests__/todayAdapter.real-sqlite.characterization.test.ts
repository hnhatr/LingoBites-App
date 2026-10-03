import {open} from 'react-native-quick-sqlite';

import {captureErrorEvent} from '@features/speaking/logic/data/SpeakingRepository';

import {DB_NAME} from '@core/db/constants';
import {resetDatabaseForTests} from '@core/db/database';
import {
  APP_SCHEMA_VERSION,
  readAppSchemaVersion,
  runMigrations,
} from '@core/db/migrations';
import {recordLessonEvent} from '@core/sync/lessonProgress';

import {
  DEFAULT_CANONICAL_LESSON_ID,
  readSeededLessonDownload,
  seedCanonicalLessonDownload,
} from '@test/support/canonicalDownloadSeed';

import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {getLearnerStateSnapshot} from '../todayAdapter';

const NOW = '2026-09-06T12:00:00.000Z';

function setupDb() {
  __resetMockDatabases();
  const db = open({name: DB_NAME});
  resetDatabaseForTests(db);
  runMigrations(db);
  return db;
}

describe('todayAdapter real SQLite (TASK-008)', () => {
  beforeEach(() => setupDb());

  it('reports empty downloads before any canonical snapshot is stored', () => {
    const snapshot = getLearnerStateSnapshot(NOW);
    expect(snapshot.hasDownloadedLessons).toBe(false);
    expect(snapshot.lessonProgression.nextLessonId).toBeNull();
  });

  it('builds progression from lesson_downloads and lesson_progress', () => {
    seedCanonicalLessonDownload();
    recordLessonEvent({
      lessonId: DEFAULT_CANONICAL_LESSON_ID,
      event: 'start',
      occurredAt: NOW,
    });
    const snapshot = getLearnerStateSnapshot(NOW);
    expect(snapshot.hasDownloadedLessons).toBe(true);
    expect(snapshot.lessonProgression.nextLessonId).toBe(
      DEFAULT_CANONICAL_LESSON_ID,
    );
    expect(readSeededLessonDownload()).not.toBeNull();
  });

  it('skips completed downloads when picking the next lesson (LING-222 R-004)', () => {
    seedCanonicalLessonDownload();
    recordLessonEvent({
      lessonId: DEFAULT_CANONICAL_LESSON_ID,
      event: 'complete',
      occurredAt: NOW,
    });
    const snapshot = getLearnerStateSnapshot(NOW);
    expect(snapshot.lessonProgression.completedLessonIds).toEqual([
      DEFAULT_CANONICAL_LESSON_ID,
    ]);
    expect(snapshot.lessonProgression.nextLessonId).toBeNull();
  });

  it('schema v3 drops retired package tables after migrations', () => {
    expect(readAppSchemaVersion(open({name: DB_NAME}))).toBe(
      APP_SCHEMA_VERSION,
    );
    const db = open({name: DB_NAME});
    expect(() =>
      db.execute('SELECT 1 FROM content_packages LIMIT 1;'),
    ).toThrow();
  });

  it('still surfaces speaking errors in the learner snapshot', () => {
    captureErrorEvent({
      id: 'err-today-1',
      source: 'speaking_room',
      category: 'listening',
      lessonId: 'lesson-a',
      createdAt: NOW,
    });
    const snapshot = getLearnerStateSnapshot(NOW);
    expect(snapshot.recentErrors).toHaveLength(1);
  });
});
