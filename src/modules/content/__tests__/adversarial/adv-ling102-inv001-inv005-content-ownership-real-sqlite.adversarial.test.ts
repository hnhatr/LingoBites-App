import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  getDatabase,
  resetDatabaseForTests,
  withTransaction,
} from '@shared/db/database';
import {runMigrations} from '@shared/db/migrations';
import * as legacyLessonState from '@shared/db/ContentLessonStateRepository';
import * as legacyPackage from '@shared/db/ContentPackageRepository';
import * as legacyRuntime from '@shared/db/ContentRuntimeRepository';
import * as contentBarrel from '@modules/content';
import * as queryPort from '../../contentQueryPort';
import * as dataLessonState from '../../data/ContentLessonStateRepository';
import * as dataPackage from '../../data/ContentPackageRepository';
import * as dataRuntime from '../../data/ContentRuntimeRepository';
import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@/test-support/adversarial/realSqlite';
import {PRIOR_SCHEMA_403BC52} from '@/test-support/adversarial/priorSchema403bc52';

/**
 * LING-102 adversarial review (INV-001 / INV-005, TASK-013 content domain
 * ownership). All tests run production repositories, migrations and
 * `withTransaction` against a real SQLite file (`node:sqlite`) through the
 * production `getDatabase()` cold-start path.
 */

const T0 = '2026-09-10T08:00:00.000Z';
const T1 = '2026-09-20T08:00:00.000Z';

let dir: string;
let dbFile: string;

function coldStart(): RealSqliteConnection {
  const connection = openRealSqlite(dbFile);
  resetDatabaseForTests(connection);
  getDatabase();
  return connection;
}

function count(sql: string, params: unknown[] = []): number {
  const row = getDatabase()
    .execute(sql, params as never[])
    .rows?.item(0) as {n: number} | undefined;
  return row?.n ?? 0;
}

function activeCount(): number {
  return count(
    'SELECT COUNT(*) AS n FROM content_packages WHERE is_active = 1;',
  );
}

function lessonStateCount(lessonId: string): number {
  return count(
    'SELECT COUNT(*) AS n FROM content_lesson_state WHERE lesson_id = ?;',
    [lessonId],
  );
}

function outboxCount(lessonId: string): number {
  return count(
    `SELECT COUNT(*) AS n FROM sync_outbox
     WHERE event_type = 'content_lesson_state' AND entity_id = ?;`,
    [lessonId],
  );
}

function pkg(id: string, isActive: boolean) {
  return {
    id,
    slug: id,
    schemaVersion: '0.1.0',
    sourceUrl: `https://example.com/${id}.zip`,
    sha256: id,
    importedAt: T0,
    isActive,
  };
}

function seedPriorInstall(raw: RealSqliteConnection) {
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
    `INSERT INTO content_packages (id, slug, schema_version, source_url, sha256,
      is_active, imported_at, deactivated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    ['pkg-old', 'v1', '0.1.0', 'https://example.com/v1.zip', 'a', T0, T1],
  );
  exec(
    `INSERT INTO content_packages (id, slug, schema_version, source_url, sha256,
      is_active, imported_at, deactivated_at) VALUES (?, ?, ?, ?, ?, 1, ?, NULL)`,
    ['pkg-live', 'v2', '0.1.0', 'https://example.com/v2.zip', 'b', T1],
  );
  exec(
    `INSERT INTO content_lesson_state (lesson_id, is_saved, is_started,
      created_at, updated_at) VALUES (?, 1, 1, ?, ?)`,
    ['lesson-both', T0, T1],
  );
  exec(
    `INSERT INTO content_lesson_state (lesson_id, is_saved, is_started,
      created_at, updated_at) VALUES (?, 0, 1, ?, ?)`,
    ['lesson-started', T0, T0],
  );
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ling102-adv-'));
  dbFile = path.join(dir, 'lingobites.sqlite');
});

afterEach(() => {
  resetDatabaseForTests(null);
  fs.rmSync(dir, {recursive: true, force: true});
});

describe('LING-102 adversarial: content domain ownership (real SQLite)', () => {
  it('ADV-H01 / INV-005: legacy shared/db shims, private data modules and Public surface share one function instance per export', () => {
    const pairs: Array<[Record<string, unknown>, Record<string, unknown>]> = [
      [legacyLessonState, dataLessonState],
      [legacyPackage, dataPackage],
      [legacyRuntime, dataRuntime],
    ];
    for (const [legacy, data] of pairs) {
      const dataKeys = Object.keys(data).sort();
      expect(Object.keys(legacy).sort()).toEqual(dataKeys);
      for (const key of dataKeys) {
        expect(legacy[key]).toBe(data[key]);
      }
    }
    const surfaces = [
      contentBarrel as Record<string, unknown>,
      queryPort as Record<string, unknown>,
    ];
    const allData = {
      ...dataLessonState,
      ...dataPackage,
      ...dataRuntime,
    } as Record<string, unknown>;
    for (const surface of surfaces) {
      for (const [key, value] of Object.entries(surface)) {
        if (key in allData) {
          expect(value).toBe(allData[key]);
        }
      }
    }
  });

  it('ADV-H02 / INV-001 / INV-005: rows persisted by the pre-move schema survive cold-start upgrade and repeated runMigrations through @modules/content', () => {
    const seed = openRealSqlite(dbFile);
    seedPriorInstall(seed);
    seed.close();

    let db = coldStart();
    runMigrations(getDatabase());
    runMigrations(getDatabase());

    expect(contentBarrel.getActivePackage()?.id).toBe('pkg-live');
    expect(queryPort.getPackageById('pkg-old')).toMatchObject({
      isActive: false,
      deactivatedAt: T1,
    });
    expect(activeCount()).toBe(1);
    expect(count('SELECT COUNT(*) AS n FROM content_packages;')).toBe(2);
    expect(contentBarrel.getContentLessonState('lesson-both')).toMatchObject({
      isSaved: true,
      isStarted: true,
      createdAt: T0,
      updatedAt: T1,
      tombstone: false,
    });
    expect(contentBarrel.getContentLessonState('lesson-started')).toMatchObject(
      {isSaved: false, isStarted: true},
    );
    expect(lessonStateCount('lesson-both')).toBe(1);
    expect(lessonStateCount('lesson-started')).toBe(1);
    expect(contentBarrel.listSavedLessons().map(s => s.lessonId)).toEqual([
      'lesson-both',
    ]);
    expect(
      contentBarrel
        .listStartedLessons()
        .map(s => s.lessonId)
        .sort(),
    ).toEqual(['lesson-both', 'lesson-started']);

    db.close();
    db = coldStart();
    expect(contentBarrel.getActivePackage()?.id).toBe('pkg-live');
    expect(activeCount()).toBe(1);
    expect(lessonStateCount('lesson-both')).toBe(1);
    db.close();
  });

  it('ADV-H03 / INV-005: interleaved and repeated writes through the legacy shim and the module port converge on one lesson-state row', () => {
    let db = coldStart();
    const LESSON = 'lesson-mixed';

    expect(
      legacyLessonState.saveContentLesson({lessonId: LESSON, now: T0}),
    ).toEqual({ok: true, duplicate: false});
    expect(
      contentBarrel.startContentLesson({lessonId: LESSON, now: T0}),
    ).toEqual({
      ok: true,
      duplicate: true,
    });
    for (let i = 0; i < 25; i += 1) {
      const writer = i % 2 === 0 ? legacyLessonState : queryPort;
      expect(writer.saveContentLesson({lessonId: LESSON, now: T1}).ok).toBe(
        true,
      );
      expect(writer.startContentLesson({lessonId: LESSON, now: T1}).ok).toBe(
        true,
      );
    }
    expect(queryPort.unsaveContentLesson(LESSON, T1)).toBe(true);
    expect(
      legacyLessonState.saveContentLesson({lessonId: LESSON, now: T1}),
    ).toEqual({ok: true, duplicate: true});

    expect(lessonStateCount(LESSON)).toBe(1);
    // 2 initial + 50 repeated + unsave + resave: one outbox event per write.
    expect(outboxCount(LESSON)).toBe(54);

    db.close();
    db = coldStart();
    runMigrations(getDatabase());
    expect(lessonStateCount(LESSON)).toBe(1);
    expect(outboxCount(LESSON)).toBe(54);
    expect(contentBarrel.getContentLessonState(LESSON)).toMatchObject({
      lessonId: LESSON,
      isSaved: true,
      isStarted: true,
      createdAt: T0,
    });
    expect(
      contentBarrel.listSavedLessons().filter(s => s.lessonId === LESSON),
    ).toHaveLength(1);
    expect(
      contentBarrel.listStartedLessons().filter(s => s.lessonId === LESSON),
    ).toHaveLength(1);
    db.close();
  });

  it('ADV-H04 / INV-001 / INV-005: active package singleton holds under repeated swaps, duplicate active insert and a rolled-back swap', () => {
    let db = coldStart();
    contentBarrel.insertPackageRecord(pkg('pkg-a', true));
    legacyPackage.insertPackageRecord(pkg('pkg-b', false));

    contentBarrel.swapActivePackage('pkg-b', T1);
    legacyPackage.swapActivePackage('pkg-b', T1);
    expect(activeCount()).toBe(1);
    expect(contentBarrel.getActivePackage()?.id).toBe('pkg-b');

    legacyPackage.swapActivePackage('pkg-a', T1);
    contentBarrel.swapActivePackage('pkg-a', T1);
    expect(activeCount()).toBe(1);
    expect(legacyPackage.getActivePackage()?.id).toBe('pkg-a');

    expect(() =>
      contentBarrel.insertPackageRecord(pkg('pkg-c', true)),
    ).toThrow();
    expect(activeCount()).toBe(1);
    expect(queryPort.getPackageById('pkg-c')).toBeNull();

    contentBarrel.insertPackageRecord(pkg('pkg-c', false));
    expect(() =>
      withTransaction(getDatabase(), () => {
        contentBarrel.swapActivePackage('pkg-c', T1);
        throw new Error('crash after swap, before commit');
      }),
    ).toThrow('crash after swap, before commit');
    expect(activeCount()).toBe(1);
    expect(contentBarrel.getActivePackage()?.id).toBe('pkg-a');

    db.close();
    db = coldStart();
    runMigrations(getDatabase());
    expect(activeCount()).toBe(1);
    expect(contentBarrel.getActivePackage()?.id).toBe('pkg-a');
    expect(
      queryPort
        .listPackages()
        .map(p => p.id)
        .sort(),
    ).toEqual(['pkg-a', 'pkg-b', 'pkg-c']);
    db.close();
  });
});
