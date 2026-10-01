import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {resetDatabaseForTests, withTransaction} from '@core/db/database';
import {clearAllLocalDatabaseRows} from '@core/db/localDataWipe';
import {
  APP_SCHEMA_VERSION,
  readAppSchemaVersion,
  runMigrations,
} from '@core/db/migrations';
import {getLessonProgress, recordLessonEvent} from '@core/sync/lessonProgress';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

/**
 * LING-176 (TASK-008): SQLite schema v3 cutover on real SQLite (INV-003, INV-001).
 *
 * Attack catalogue:
 * - ADV-001 / INV-003: re-running runMigrations (app restart / next launch) resurrects dropped legacy tables.
 * - ADV-002 / INV-003: schema v3 upgrade preserves lesson_progress rows and live outbox records while purging retired event types.
 * - ADV-003 / INV-003 / INV-010: recordLessonEvent commits local progress and outbox row atomically in one transaction.
 * - ADV-004 / INV-001 (App): rank merge prevents regression from completed to in_progress.
 * - ADV-005 / INV-003 / EC-015: clearAllLocalDatabaseRows clears downloads and progress cleanly on schema v3.
 */

const RETIRED_TABLE_NAMES = [
  'practice_sets',
  'practice_questions',
  'practice_sessions',
  'practice_events',
  'youtube_lessons',
  'youtube_sentences',
  'youtube_progress',
  'content_review_items',
  'content_lesson_state',
  'content_packages',
  'content_lessons',
  'content_items',
  'content_units',
  'content_activities',
  'content_audio_assets',
  'lessons',
  'lesson_v2',
  'lesson_v2_sentences',
  'lesson_v2_chunks',
  'lesson_v2_vocabulary',
  'lesson_v2_grammar',
  'lesson_v2_units',
];

let dbFile: string;
let db: RealSqliteConnection;

function tableNames(): string[] {
  const rows = db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;",
  ).rows;
  const names: string[] = [];
  for (let i = 0; i < (rows?.length ?? 0); i += 1) {
    names.push((rows?.item(i) as {name: string}).name);
  }
  return names;
}

function outboxIds(): string[] {
  const rows = db.execute('SELECT id FROM sync_outbox ORDER BY id;').rows;
  const ids: string[] = [];
  for (let i = 0; i < (rows?.length ?? 0); i += 1) {
    ids.push((rows?.item(i) as {id: string}).id);
  }
  return ids;
}

beforeEach(() => {
  dbFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'ling176-v3-cutover-')),
    'lingobites.sqlite',
  );
  db = openRealSqlite(dbFile);
  resetDatabaseForTests(db);
});

afterEach(() => {
  try {
    db.close();
  } catch {
    // already closed
  }
  resetDatabaseForTests(null);
  fs.rmSync(path.dirname(dbFile), {recursive: true, force: true});
});

describe('ADV / LING-176 schema v3 cutover on real SQLite', () => {
  it('ADV-001 / INV-003: re-running runMigrations on schema v3 resurrects dropped legacy tables', () => {
    // First run (e.g. app upgrade or initial install to v3)
    runMigrations(db);
    expect(readAppSchemaVersion(db)).toBe(3);

    // After first run, legacy tables are dropped by ensureSchemaV3Upgrade
    const tablesAfterRun1 = tableNames();
    expect(tablesAfterRun1).not.toContain('practice_sets');
    expect(tablesAfterRun1).not.toContain('youtube_lessons');
    expect(tablesAfterRun1).not.toContain('content_review_items');
    expect(tablesAfterRun1).not.toContain('content_lesson_state');

    // Second run (simulating next app launch / restart)
    // The database is already at schema version 3.
    runMigrations(db);
    expect(readAppSchemaVersion(db)).toBe(3);

    // INV-003 / TASK-008: Retired tables must remain absent.
    // BUG: runMigrations unconditionally executes MIGRATIONS (which contains
    // CREATE TABLE IF NOT EXISTS for practice_*, youtube_*, content_*, etc.),
    // recreating them because ensureSchemaV3Upgrade skips when user_version >= 3.
    const tablesAfterRun2 = tableNames();
    for (const table of RETIRED_TABLE_NAMES) {
      expect(tablesAfterRun2).not.toContain(table);
    }
  });

  it('ADV-002 / INV-003: schema v3 upgrade preserves lesson_progress rows and live outbox records while purging retired event types', () => {
    // Perform initial migration to set up tables
    runMigrations(db);
    expect(readAppSchemaVersion(db)).toBe(3);

    const at = '2026-10-01T10:00:00.000Z';

    // Seed live lesson_progress rows
    db.execute(
      `INSERT INTO lesson_progress (lesson_id, status, started_at, completed_at, updated_at)
       VALUES (?, ?, ?, ?, ?);`,
      ['lesson-completed', 'completed', at, at, at],
    );
    db.execute(
      `INSERT INTO lesson_progress (lesson_id, status, started_at, completed_at, updated_at)
       VALUES (?, ?, ?, NULL, ?);`,
      ['lesson-started', 'in_progress', at, at],
    );

    // Seed live lesson_downloads row
    db.execute(
      `INSERT INTO lesson_downloads (lesson_id, content_revision, contract_version, snapshot_json, downloaded_at)
       VALUES (?, ?, ?, ?, ?);`,
      ['lesson-completed', 3, 1, JSON.stringify({id: 'lesson-completed'}), at],
    );

    // Seed live grammar_bookmarks row
    db.execute(
      `INSERT INTO grammar_bookmarks (lesson_id, grammar_id, package_id, saved_at, created_at, updated_at, name)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      ['lesson-completed', 'g1', 'pkg-1', at, at, at, 'Passive Voice'],
    );

    // Seed sync_outbox with both live and retired event types
    db.execute(
      `INSERT INTO sync_outbox (id, event_type, entity_id, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?);`,
      [
        'progress-outbox-1',
        'lesson_progress',
        'lesson-completed',
        JSON.stringify({event: 'complete'}),
        at,
      ],
    );
    db.execute(
      `INSERT INTO sync_outbox (id, event_type, entity_id, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?);`,
      [
        'review-outbox-1',
        'review',
        'card-1',
        JSON.stringify({schema_version: 1}),
        at,
      ],
    );

    const retiredOutbox = [
      ['retired-practice-1', 'practice_answered', 'p-1'],
      ['retired-review-item-1', 'content_review_items', 'cri-1'],
      ['retired-review-state-1', 'content_review_state', 'crs-1'],
      ['retired-cls-1', 'content_lesson_state', 'cls-1'],
      ['retired-yt-lesson-1', 'youtube_lessons', 'yt-1'],
      ['retired-yt-sentence-1', 'youtube_sentences', 'yt-s-1'],
      ['retired-yt-progress-1', 'youtube_progress', 'yt-p-1'],
    ];
    for (const [id, eventType, entityId] of retiredOutbox) {
      db.execute(
        `INSERT INTO sync_outbox (id, event_type, entity_id, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?);`,
        [id, eventType, entityId, JSON.stringify({retired: true}), at],
      );
    }

    // Reset user_version to 2 and simulate v3 upgrade
    db.execute('PRAGMA user_version = 2;');
    expect(readAppSchemaVersion(db)).toBe(2);

    runMigrations(db);

    expect(readAppSchemaVersion(db)).toBe(3);

    // 1. lesson_progress rows are preserved intact
    const progressRows = db.execute(
      'SELECT lesson_id, status, started_at, completed_at FROM lesson_progress ORDER BY lesson_id;',
    ).rows;
    expect(progressRows?.length).toBe(2);
    expect(progressRows?.item(0)).toMatchObject({
      lesson_id: 'lesson-completed',
      status: 'completed',
    });
    expect(progressRows?.item(1)).toMatchObject({
      lesson_id: 'lesson-started',
      status: 'in_progress',
    });

    // 2. lesson_downloads and grammar_bookmarks are preserved
    const downloadRows = db.execute(
      'SELECT lesson_id, content_revision FROM lesson_downloads;',
    ).rows;
    expect(downloadRows?.length).toBe(1);
    expect(downloadRows?.item(0)).toMatchObject({
      lesson_id: 'lesson-completed',
      content_revision: 3,
    });

    const bookmarkRows = db.execute(
      'SELECT grammar_id, name FROM grammar_bookmarks;',
    ).rows;
    expect(bookmarkRows?.length).toBe(1);
    expect(bookmarkRows?.item(0)).toMatchObject({
      grammar_id: 'g1',
      name: 'Passive Voice',
    });

    // 3. sync_outbox preserves live rows and purges retired rows
    const liveIds = outboxIds();
    expect(liveIds).toEqual(['progress-outbox-1', 'review-outbox-1']);
    expect(liveIds).not.toContain('retired-practice-1');
    expect(liveIds).not.toContain('retired-review-item-1');
    expect(liveIds).not.toContain('retired-review-state-1');
    expect(liveIds).not.toContain('retired-cls-1');
    expect(liveIds).not.toContain('retired-yt-lesson-1');
    expect(liveIds).not.toContain('retired-yt-sentence-1');
    expect(liveIds).not.toContain('retired-yt-progress-1');
  });

  it('ADV-003 / INV-003 / INV-010: transaction atomicity between progress write and outbox enqueue', () => {
    runMigrations(db);

    expect(getLessonProgress('atomic-lesson')).toBeNull();

    const at = '2026-10-01T12:00:00.000Z';
    const result = recordLessonEvent({
      lessonId: 'atomic-lesson',
      event: 'start',
      occurredAt: at,
      eventId: 'evt-atomic-1',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok');
    expect(result.advanced).toBe(true);
    expect(getLessonProgress('atomic-lesson')?.status).toBe('in_progress');

    const outboxRows = db.execute(
      'SELECT id, event_type, entity_id FROM sync_outbox WHERE id = ?;',
      ['evt-atomic-1'],
    ).rows;
    expect(outboxRows?.length).toBe(1);
    expect(outboxRows?.item(0)).toMatchObject({
      id: 'evt-atomic-1',
      event_type: 'lesson_progress',
      entity_id: 'atomic-lesson',
    });

    // Injected failure rolls back progress change
    expect(() => {
      withTransaction(db, () => {
        db.execute(
          `UPDATE lesson_progress SET status = 'completed' WHERE lesson_id = 'atomic-lesson';`,
        );
        throw new Error('Simulated failure before outbox commit');
      });
    }).toThrow('Simulated failure before outbox commit');

    expect(getLessonProgress('atomic-lesson')?.status).toBe('in_progress');
  });

  it('ADV-004 / INV-001 (App): rank merge prevents regression from completed to in_progress', () => {
    runMigrations(db);

    const at1 = '2026-10-01T12:00:00.000Z';
    recordLessonEvent({
      lessonId: 'monotonic-lesson',
      event: 'complete',
      occurredAt: at1,
    });
    expect(getLessonProgress('monotonic-lesson')?.status).toBe('completed');

    const at2 = '2026-10-01T12:05:00.000Z';
    const regressed = recordLessonEvent({
      lessonId: 'monotonic-lesson',
      event: 'start',
      occurredAt: at2,
    });

    expect(regressed.ok).toBe(true);
    if (!regressed.ok) throw new Error('Expected ok');
    expect(regressed.advanced).toBe(false);
    const after = getLessonProgress('monotonic-lesson');
    expect(after?.status).toBe('completed');
    expect(after?.completedAt).toBe(at1);
  });

  it('ADV-005 / INV-003 / EC-015: clearAllLocalDatabaseRows clears downloads and progress on schema v3', async () => {
    runMigrations(db);

    const at = '2026-10-01T12:00:00.000Z';
    db.execute(
      `INSERT INTO lesson_downloads (lesson_id, content_revision, contract_version, snapshot_json, downloaded_at)
       VALUES ('lesson-wipe', 1, 1, '{}', ?);`,
      [at],
    );
    db.execute(
      `INSERT INTO lesson_progress (lesson_id, status, started_at, completed_at, updated_at)
       VALUES ('lesson-wipe', 'completed', ?, ?, ?);`,
      [at, at, at],
    );

    await clearAllLocalDatabaseRows();

    const downloadsCount = (
      db
        .execute('SELECT COUNT(*) AS c FROM lesson_downloads;')
        .rows?.item(0) as {c: number}
    ).c;
    const progressCount = (
      db
        .execute('SELECT COUNT(*) AS c FROM lesson_progress;')
        .rows?.item(0) as {c: number}
    ).c;

    expect(downloadsCount).toBe(0);
    expect(progressCount).toBe(0);
    expect(readAppSchemaVersion(db)).toBe(APP_SCHEMA_VERSION);
  });
});
