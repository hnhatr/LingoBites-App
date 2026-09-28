import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {getDatabase, resetDatabaseForTests} from '@shared/db/database';
import {runMigrations} from '@shared/db/migrations';
import {
  getActivePackage,
  getContentLessonState,
  insertPackageRecord,
  saveContentLesson,
  startContentLesson,
  swapActivePackage,
} from '@modules/content';
import {CHARACTERIZATION_INVARIANTS} from '@/test-support/characterization';
import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@/test-support/adversarial/realSqlite';

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
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ling102-content-real-sqlite-'));
  dbFile = path.join(dir, 'lingobites.sqlite');
});

afterEach(() => {
  resetDatabaseForTests(null);
  fs.rmSync(dir, {recursive: true, force: true});
});

describe('content domain ownership (real SQLite / node:sqlite)', () => {
  it(`${CHARACTERIZATION_INVARIANTS.INV_001}: active package singleton and lesson progress survive reopen via @modules/content`, () => {
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
    saveContentLesson({lessonId: 'lesson-owned', now: NOW});
    startContentLesson({lessonId: 'lesson-owned', now: NOW});

    db.close();

    db = coldStart();
    expect(getActivePackage()?.id).toBe('pkg-b');
    expect(getContentLessonState('lesson-owned')).toMatchObject({
      lessonId: 'lesson-owned',
      isSaved: true,
      isStarted: true,
      tombstone: false,
    });

    runMigrations(getDatabase());
    expect(getActivePackage()?.id).toBe('pkg-b');
    expect(getContentLessonState('lesson-owned')?.isStarted).toBe(true);

    db.close();
  });
});
