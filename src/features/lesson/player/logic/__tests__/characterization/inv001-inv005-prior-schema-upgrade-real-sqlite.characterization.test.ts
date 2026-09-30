import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  getContentLessonState,
  saveContentLesson,
} from '@features/lesson/packages/logic/data/ContentLessonStateRepository';
import {
  getActivePackage,
  getPackageById,
} from '@features/lesson/packages/logic/data/ContentPackageRepository';

import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {PRIOR_SCHEMA_403BC52} from '@test/support/adversarial/priorSchema403bc52';
import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';
import {CHARACTERIZATION_INVARIANTS} from '@test/support/characterization';

/**
 * LING-100 HC-02: real SQLite upgrade-read oracle for curriculumLesson catalog
 * (content_packages active singleton) and learner progress (content_lesson_state).
 * Seeds the frozen 403bc52 schema (pre-SETE-298 revision/tombstone), then runs
 * production `getDatabase()` / `runMigrations` on reopen.
 */

const T0 = '2026-09-10T08:00:00.000Z';
const NOW = '2026-09-27T12:00:00.000Z';

function applyPriorSchema(raw: RealSqliteConnection) {
  for (const sql of PRIOR_SCHEMA_403BC52) {
    try {
      raw.execute(sql);
    } catch (error) {
      if (!String((error as Error).message).includes('duplicate column')) {
        throw error;
      }
    }
  }
}

function seedPriorCurriculumCatalog(raw: RealSqliteConnection) {
  applyPriorSchema(raw);
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
      'pkg-prior-b',
      'catalog-v2',
      '0.1.0',
      'https://example.com/v2.zip',
      'sha-prior-b',
      T0,
    ],
  );
  exec(
    `INSERT INTO content_lesson_state (
      lesson_id, is_saved, is_started, created_at, updated_at
    ) VALUES (?, 1, 1, ?, ?)`,
    ['lesson-prior', T0, T0],
  );
}

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
    path.join(os.tmpdir(), 'ling100-curriculum-prior-upgrade-'),
  );
  dbFile = path.join(dir, 'lingobites.sqlite');
  const prior = openRealSqlite(dbFile);
  seedPriorCurriculumCatalog(prior);
  prior.close();
});

afterEach(() => {
  resetDatabaseForTests(null);
  fs.rmSync(dir, {recursive: true, force: true});
});

describe('curriculumLesson prior-schema upgrade-read (real SQLite / node:sqlite)', () => {
  it(`${CHARACTERIZATION_INVARIANTS.INV_001}: 403bc52 catalog and lesson progress upgrade to head and stay readable`, () => {
    let db = coldStart();

    expect(getActivePackage()).toMatchObject({
      id: 'pkg-prior-b',
      slug: 'catalog-v2',
      isActive: true,
    });
    expect(getPackageById('pkg-prior-a')).toMatchObject({
      id: 'pkg-prior-a',
      isActive: false,
    });
    expect(getContentLessonState('lesson-prior')).toMatchObject({
      lessonId: 'lesson-prior',
      isSaved: true,
      isStarted: true,
      revision: 0,
      tombstone: false,
    });

    expect(
      db
        .execute(
          "SELECT revision, tombstone FROM content_lesson_state WHERE lesson_id = 'lesson-prior'",
        )
        .rows?.item(0),
    ).toEqual({revision: 0, tombstone: 0});

    db.close();
    db = coldStart();
    runMigrations(getDatabase());
    expect(getActivePackage()?.id).toBe('pkg-prior-b');
    expect(getContentLessonState('lesson-prior')?.isStarted).toBe(true);
    db.close();
  });

  it(`${CHARACTERIZATION_INVARIANTS.INV_005}: idempotent lesson progress upsert after prior-schema upgrade`, () => {
    const db = coldStart();

    const firstSave = saveContentLesson({
      lessonId: 'lesson-prior',
      now: NOW,
    });
    const secondSave = saveContentLesson({
      lessonId: 'lesson-prior',
      now: NOW,
    });
    expect(firstSave.ok && firstSave.duplicate).toBe(true);
    expect(secondSave.ok && secondSave.duplicate).toBe(true);
    expect(getContentLessonState('lesson-prior')).toMatchObject({
      isSaved: true,
      isStarted: true,
    });
    expect(getActivePackage()?.id).toBe('pkg-prior-b');

    db.close();
    coldStart();
    expect(getContentLessonState('lesson-prior')?.isStarted).toBe(true);
  });
});
