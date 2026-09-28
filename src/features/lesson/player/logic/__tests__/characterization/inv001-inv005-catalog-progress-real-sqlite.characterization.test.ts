import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {
  getActivePackage,
  insertPackageRecord,
  swapActivePackage,
} from '@features/lesson/packages/logic/data/ContentPackageRepository';
import {
  getContentLessonState,
  saveContentLesson,
  startContentLesson,
} from '@features/lesson/packages/logic/data/ContentLessonStateRepository';
import {CHARACTERIZATION_INVARIANTS} from '@/test-support/characterization';
import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@/test-support/adversarial/realSqlite';

/**
 * Supplemental same-schema reopen checks on real `node:sqlite` (not the upgrade
 * oracle). Prior-schema upgrade-read evidence lives in
 * `inv001-inv005-prior-schema-upgrade-real-sqlite.characterization.test.ts`.
 */

const NOW = '2026-09-27T12:00:00.000Z';

let dir: string;
let dbFile: string;

function coldStart(): RealSqliteConnection {
  const connection = openRealSqlite(dbFile);
  resetDatabaseForTests(connection);
  getDatabase();
  return connection;
}

beforeEach(() => {
  dir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'ling100-curriculum-real-sqlite-'),
  );
  dbFile = path.join(dir, 'lingobites.sqlite');
});

afterEach(() => {
  resetDatabaseForTests(null);
  fs.rmSync(dir, {recursive: true, force: true});
});

describe('curriculumLesson catalog and progress (real SQLite / node:sqlite)', () => {
  it(`${CHARACTERIZATION_INVARIANTS.INV_001}: active catalog and lesson progress survive file reopen and idempotent migrations`, () => {
    let db = coldStart();

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
    saveContentLesson({lessonId: 'lesson-char', now: NOW});
    startContentLesson({lessonId: 'lesson-char', now: NOW});

    db.close();

    db = coldStart();
    expect(getActivePackage()?.id).toBe('pkg-b');
    expect(getContentLessonState('lesson-char')).toMatchObject({
      lessonId: 'lesson-char',
      isSaved: true,
      isStarted: true,
      tombstone: false,
    });

    runMigrations(getDatabase());
    expect(getActivePackage()?.id).toBe('pkg-b');
    expect(getContentLessonState('lesson-char')?.isStarted).toBe(true);

    db.close();
  });

  it(`${CHARACTERIZATION_INVARIANTS.INV_005}: single active content package and idempotent lesson progress upserts on real SQLite`, () => {
    const db = coldStart();

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
    expect(getContentLessonState('lesson-content-1')).toMatchObject({
      lessonId: 'lesson-content-1',
      isSaved: true,
      isStarted: true,
    });

    db.close();
    coldStart();
    expect(getContentLessonState('lesson-content-1')?.isStarted).toBe(true);
    expect(getActivePackage()?.id).toBe('pkg-b');
  });
});
