import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {
  getActivePackage,
  getContentLessonById,
  getContentLessonState,
  insertPackageRecord,
  listActivePackageLessons,
  saveContentLesson,
  startContentLesson,
  swapActivePackage,
} from '@features/lesson/packages';
import {getPackageById} from '../../contentQueryPort';
import {CHARACTERIZATION_INVARIANTS} from '@test/support/characterization';
import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';
import {PRIOR_SCHEMA_403BC52} from '@test/support/adversarial/priorSchema403bc52';

const NOW = '2026-09-27T12:00:00.000Z';
const T0 = '2026-09-10T08:00:00.000Z';
const LESSON_ID = 'lesson-owned';
const PRIOR_LESSON_ID = 'lesson-prior';
const PRIOR_ACTIVE_PACKAGE_ID = 'pkg-prior-b';

let dir: string;
let dbFile: string;

function countRows(sql: string, params: unknown[] = []): number {
  const result = getDatabase().execute(sql, params as never[]);
  const row = result.rows?.item(0) as {n: number} | undefined;
  return row?.n ?? 0;
}

function expectNoCatalogOrProgressDuplicates(lessonId = LESSON_ID): void {
  expect(
    countRows(
      'SELECT COUNT(*) AS n FROM content_packages WHERE is_active = 1;',
    ),
  ).toBe(1);
  expect(
    countRows(
      'SELECT COUNT(*) AS n FROM content_lesson_state WHERE lesson_id = ?;',
      [lessonId],
    ),
  ).toBe(1);
}

function seedPriorContentInstall(raw: RealSqliteConnection): void {
  for (const sql of PRIOR_SCHEMA_403BC52) {
    try {
      raw.execute(sql);
    } catch (error) {
      if (!String((error as Error).message).includes('duplicate column')) {
        throw error;
      }
    }
  }
  const exec = (sql: string, params: unknown[]) =>
    raw.execute(sql, params as never[]);
  exec(
    `INSERT INTO content_packages (
      id, slug, schema_version, source_url, sha256, is_active, imported_at, deactivated_at
    ) VALUES (?, ?, ?, ?, ?, 0, ?, NULL)`,
    [
      'pkg-prior-a',
      'catalog-v1',
      '0.1.0',
      'https://example.com/v1.zip',
      'sha-prior-a',
      T0,
    ],
  );
  exec(
    `INSERT INTO content_packages (
      id, slug, schema_version, source_url, sha256, is_active, imported_at, deactivated_at
    ) VALUES (?, ?, ?, ?, ?, 1, ?, NULL)`,
    [
      PRIOR_ACTIVE_PACKAGE_ID,
      'catalog-v2',
      '0.1.0',
      'https://example.com/v2.zip',
      'sha-prior-b',
      T0,
    ],
  );
  exec(
    `INSERT INTO content_lessons (
      id, package_id, slug, schema_version, title_en, title_vi, blurb_vi,
      level, target_skills_json, estimated_duration_minutes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      PRIOR_LESSON_ID,
      PRIOR_ACTIVE_PACKAGE_ID,
      PRIOR_LESSON_ID,
      '0.1.0',
      'Prior lesson',
      'Bài cũ',
      'blurb',
      'A2',
      JSON.stringify(['speaking']),
      12,
    ],
  );
  exec(
    `INSERT INTO content_lesson_state (
      lesson_id, is_saved, is_started, created_at, updated_at
    ) VALUES (?, 1, 1, ?, ?)`,
    [PRIOR_LESSON_ID, T0, T0],
  );
}

function coldStart(): RealSqliteConnection {
  const connection = openRealSqlite(dbFile);
  resetDatabaseForTests(connection);
  getDatabase();
  return connection;
}

afterEach(() => {
  resetDatabaseForTests(null);
  fs.rmSync(dir, {recursive: true, force: true});
});

describe('content domain ownership (real SQLite / node:sqlite)', () => {
  beforeEach(() => {
    dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'ling102-content-real-sqlite-'),
    );
    dbFile = path.join(dir, 'lingobites.sqlite');
  });
  it(`${CHARACTERIZATION_INVARIANTS.INV_001}: active package singleton and lesson progress survive reopen via @features/lesson`, () => {
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

describe('content prior-schema upgrade-read (real SQLite / node:sqlite)', () => {
  beforeEach(() => {
    dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'ling102-content-prior-real-sqlite-'),
    );
    dbFile = path.join(dir, 'lingobites.sqlite');
    const prior = openRealSqlite(dbFile);
    seedPriorContentInstall(prior);
    prior.close();
  });

  it(`${CHARACTERIZATION_INVARIANTS.INV_001}: pre-move catalog, lesson, and progress upgrade-read through @features/lesson (CR-001)`, () => {
    let db = coldStart();

    expect(getActivePackage()).toMatchObject({
      id: PRIOR_ACTIVE_PACKAGE_ID,
      slug: 'catalog-v2',
      isActive: true,
    });
    expect(getPackageById('pkg-prior-a')).toMatchObject({
      id: 'pkg-prior-a',
      isActive: false,
    });
    expect(getContentLessonById(PRIOR_LESSON_ID)).toMatchObject({
      id: PRIOR_LESSON_ID,
      packageId: PRIOR_ACTIVE_PACKAGE_ID,
      titleEn: 'Prior lesson',
    });
    expect(listActivePackageLessons().map(lesson => lesson.id)).toContain(
      PRIOR_LESSON_ID,
    );
    expect(getContentLessonState(PRIOR_LESSON_ID)).toMatchObject({
      lessonId: PRIOR_LESSON_ID,
      isSaved: true,
      isStarted: true,
      tombstone: false,
    });
    expectNoCatalogOrProgressDuplicates(PRIOR_LESSON_ID);

    runMigrations(getDatabase());
    runMigrations(getDatabase());
    expect(getActivePackage()?.id).toBe(PRIOR_ACTIVE_PACKAGE_ID);
    expect(getContentLessonById(PRIOR_LESSON_ID)?.packageId).toBe(
      PRIOR_ACTIVE_PACKAGE_ID,
    );
    expect(getContentLessonState(PRIOR_LESSON_ID)?.isStarted).toBe(true);
    expectNoCatalogOrProgressDuplicates(PRIOR_LESSON_ID);

    db.close();
    db = coldStart();
    expect(getContentLessonState(PRIOR_LESSON_ID)?.lessonId).toBe(
      PRIOR_LESSON_ID,
    );
    expectNoCatalogOrProgressDuplicates(PRIOR_LESSON_ID);
    db.close();
  });

  it(`${CHARACTERIZATION_INVARIANTS.INV_005}: idempotent progress upsert after prior-schema upgrade does not duplicate rows (CR-001)`, () => {
    const db = coldStart();

    const firstSave = saveContentLesson({
      lessonId: PRIOR_LESSON_ID,
      now: NOW,
    });
    const secondSave = saveContentLesson({
      lessonId: PRIOR_LESSON_ID,
      now: NOW,
    });
    expect(firstSave.ok && firstSave.duplicate).toBe(true);
    expect(secondSave.ok && secondSave.duplicate).toBe(true);

    const repeatStart = startContentLesson({
      lessonId: PRIOR_LESSON_ID,
      now: NOW,
    });
    expect(repeatStart.ok && repeatStart.duplicate).toBe(true);
    expect(getContentLessonState(PRIOR_LESSON_ID)).toMatchObject({
      isSaved: true,
      isStarted: true,
    });
    expectNoCatalogOrProgressDuplicates(PRIOR_LESSON_ID);

    db.close();
    coldStart();
    runMigrations(getDatabase());
    expect(getActivePackage()?.id).toBe(PRIOR_ACTIVE_PACKAGE_ID);
    expectNoCatalogOrProgressDuplicates(PRIOR_LESSON_ID);
  });
});
