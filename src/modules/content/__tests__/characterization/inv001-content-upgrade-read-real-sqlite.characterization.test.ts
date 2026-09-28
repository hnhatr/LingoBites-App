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
const LESSON_ID = 'lesson-owned';

let dir: string;
let dbFile: string;

function countRows(sql: string, params: unknown[] = []): number {
  const result = getDatabase().execute(sql, params as never[]);
  const row = result.rows?.item(0) as {n: number} | undefined;
  return row?.n ?? 0;
}

function expectNoCatalogOrProgressDuplicates(): void {
  expect(
    countRows(
      'SELECT COUNT(*) AS n FROM content_packages WHERE is_active = 1;',
    ),
  ).toBe(1);
  expect(
    countRows(
      'SELECT COUNT(*) AS n FROM content_lesson_state WHERE lesson_id = ?;',
      [LESSON_ID],
    ),
  ).toBe(1);
}

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
    saveContentLesson({lessonId: LESSON_ID, now: NOW});
    startContentLesson({lessonId: LESSON_ID, now: NOW});

    db.close();

    db = coldStart();
    expect(getActivePackage()?.id).toBe('pkg-b');
    expect(getContentLessonState(LESSON_ID)).toMatchObject({
      lessonId: LESSON_ID,
      isSaved: true,
      isStarted: true,
      tombstone: false,
    });
    expectNoCatalogOrProgressDuplicates();

    runMigrations(getDatabase());
    expect(getActivePackage()?.id).toBe('pkg-b');
    expect(getContentLessonState(LESSON_ID)?.isStarted).toBe(true);

    const repeatSave = saveContentLesson({lessonId: LESSON_ID, now: NOW});
    const repeatStart = startContentLesson({lessonId: LESSON_ID, now: NOW});
    expect(repeatSave.ok && repeatSave.duplicate).toBe(true);
    expect(repeatStart.ok && repeatStart.duplicate).toBe(true);
    expectNoCatalogOrProgressDuplicates();

    db.close();
    coldStart();
    expect(getActivePackage()?.id).toBe('pkg-b');
    expect(getContentLessonState(LESSON_ID)?.lessonId).toBe(LESSON_ID);
    expectNoCatalogOrProgressDuplicates();
  });

  it(`${CHARACTERIZATION_INVARIANTS.INV_005}: idempotent save/start never duplicates catalog or lesson-state rows on real SQLite`, () => {
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

    const firstSave = saveContentLesson({lessonId: LESSON_ID, now: NOW});
    const secondSave = saveContentLesson({lessonId: LESSON_ID, now: NOW});
    expect(firstSave.ok && firstSave.duplicate).toBe(false);
    expect(secondSave.ok && secondSave.duplicate).toBe(true);

    const firstStart = startContentLesson({lessonId: LESSON_ID, now: NOW});
    const secondStart = startContentLesson({lessonId: LESSON_ID, now: NOW});
    expect(firstStart.ok && firstStart.duplicate).toBe(true);
    expect(secondStart.ok && secondStart.duplicate).toBe(true);

    expectNoCatalogOrProgressDuplicates();

    db.close();
    coldStart();
    runMigrations(getDatabase());
    expect(getActivePackage()?.id).toBe('pkg-b');
    expectNoCatalogOrProgressDuplicates();
  });
});
