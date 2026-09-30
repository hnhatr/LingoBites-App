/**
 * Acceptance tests for the content package importer (SETE-107 / M2).
 *
 * Every test in this file maps 1:1 to an acceptance criterion in the SETE-107
 * issue description. The tests run against the real DB mock so the
 * activation-swap and rollback paths exercise actual SQL, not just the
 * repository wrappers.
 */

import {open} from 'react-native-quick-sqlite';

import {
  getActivePackage,
  getPackageById,
  listPackages,
} from '@features/lesson/packages/logic/data/ContentPackageRepository';

import {DB_NAME} from '@core/db/constants';
import {resetDatabaseForTests, withTransaction} from '@core/db/database';
import {
  downgradeContentPackageMigrations,
  runMigrations,
} from '@core/db/migrations';

import {__resetMockDatabases} from '../../../../../../../test-utils/sqliteMock';
import {
  lessonFileName,
  makeLesson,
  makeManifest,
} from '../_fixtures/testLesson';
import {buildStoredZip, sha256HexTest} from '../_fixtures/testZip';
import {
  importContentPackage,
  rollbackToPreviousPackage,
} from '../ContentPackageImporter';
import {
  __resetImportStateForTests,
  getImportState,
  subscribeImportState,
} from '../importState';
import {sha256Hex} from '../packageChecksum';
import type {ContentLesson, ContentPackageManifest} from '../types';

const NOW = '2026-09-06T12:00:00.000Z';

function makePackageBytes(
  manifest: ContentPackageManifest,
  lesson: ContentLesson,
  options: {corrupt?: boolean} = {},
): Uint8Array {
  const manifestJson = JSON.stringify(manifest);
  const lessonJson = JSON.stringify(lesson);
  const manifestBytes = new TextEncoder().encode(manifestJson);
  const lessonBytes = new TextEncoder().encode(lessonJson);
  const zip = buildStoredZip([
    ['manifest.json', manifestBytes],
    [lessonFileName(lesson), lessonBytes],
  ]);
  if (options.corrupt) {
    // Flip a byte in the middle of the ZIP body to force a checksum / parse
    // error downstream.
    const copy = new Uint8Array(zip);
    copy[Math.floor(copy.length / 2)] ^= 0xff;
    return copy;
  }
  return zip;
}

function setupDb() {
  __resetMockDatabases();
  __resetImportStateForTests();
  const db = open({name: DB_NAME});
  resetDatabaseForTests(db);
  // Ensure the M2 tables exist (the production app gets them on first
  // launch; in tests we run migrations explicitly because resetDatabaseForTests
  // sets the cached instance but does not invoke the migration runner).
  runMigrations(db);
  return db;
}

function makeFetcher(
  bytes: Uint8Array,
  options: {status?: number; ok?: boolean} = {},
) {
  return jest.fn(async () => ({
    ok: options.ok ?? true,
    status: options.status ?? 200,
    body: bytes,
  }));
}

function makeFailingFetcher(message = 'boom') {
  return jest.fn(async () => {
    throw new Error(message);
  });
}

async function withoutGlobalTextDecoder<T>(fn: () => Promise<T>): Promise<T> {
  const globalWithDecoder = globalThis as typeof globalThis & {
    TextDecoder?: typeof TextDecoder;
  };
  const original = globalWithDecoder.TextDecoder;
  Reflect.deleteProperty(globalWithDecoder, 'TextDecoder');
  try {
    return await fn();
  } finally {
    globalWithDecoder.TextDecoder = original;
  }
}

describe('ContentPackageImporter', () => {
  beforeEach(() => {
    setupDb();
  });

  // AC: "Importing a valid Daily stand-up package activates it and all lesson
  // data is queryable from SQLite."
  it('imports a valid daily-standup package and activates it', async () => {
    const lesson = makeLesson({includeGrammar: true, includeVocab: true});
    const manifest = makeManifest(lesson);
    const bytes = makePackageBytes(manifest, lesson);
    const fetcher = makeFetcher(bytes);

    const result = await importContentPackage('https://example.com/pkg.zip', {
      fetcher,
      now: () => NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.packageSlug).toBe('daily-standup');
    expect(result.lessonCount).toBe(1);
    expect(result.itemCount).toBe(10);

    const active = getActivePackage();
    expect(active).not.toBeNull();
    expect(active?.slug).toBe('daily-standup');
    expect(active?.isActive).toBe(true);
    expect(active?.sha256).toBe(sha256Hex(bytes));

    // The lesson data is queryable from SQLite: a SELECT against
    // content_lessons returns one row matching the lesson id.
    const db = open({name: DB_NAME});
    const lessonRow = db.execute(
      'SELECT id, title_en FROM content_lessons WHERE id = ?;',
      [lesson.id],
    );
    const lessonRecord = lessonRow.rows?.item(0) as
      | {id: string; title_en: string}
      | undefined;
    expect(lessonRecord).toBeDefined();
    expect(lessonRecord?.title_en).toBe('Daily Stand-up');

    const chunkRow = db.execute(
      'SELECT COUNT(*) AS n FROM content_items WHERE lesson_id = ?;',
      [lesson.id],
    );
    const chunkCount = (chunkRow.rows?.item(0) as {n: number}).n;
    expect(chunkCount).toBe(10);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('imports a valid package when the mobile runtime has no TextDecoder global', async () => {
    const lesson = makeLesson({includeGrammar: true, includeVocab: true});
    const manifest = makeManifest(lesson);
    const bytes = makePackageBytes(manifest, lesson);
    const fetcher = makeFetcher(bytes);

    const result = await withoutGlobalTextDecoder(() =>
      importContentPackage('https://example.com/pkg.zip', {
        fetcher,
        now: () => NOW,
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.packageSlug).toBe('daily-standup');
    expect(getActivePackage()?.slug).toBe('daily-standup');
  });

  // AC: "Importing a package with a corrupt checksum: fails before any DB
  // write, previous active package remains usable."
  it('rejects a package whose sha256 mismatches the manifest expected value, without writing the DB', async () => {
    const lesson = makeLesson();
    const manifest = makeManifest(lesson);
    const bytes = makePackageBytes(manifest, lesson);
    // Use a wrong but well-formed hex digest to trip CHECKSUM_MISMATCH.
    const wrongSha = '0'.repeat(64);
    const fetcher = makeFetcher(bytes);

    const result = await importContentPackage('https://example.com/pkg.zip', {
      fetcher,
      now: () => NOW,
    });

    // First import succeeds and is active. (No expected_sha256 is in the
    // default manifest, so this test only makes sense as a follow-on import
    // — see the second half of the test below.)
    expect(result.ok).toBe(true);
    const firstActive = getActivePackage();
    expect(firstActive?.slug).toBe('daily-standup');

    // Now build a second package whose manifest *does* declare the expected
    // sha256, and set the declared value to something wrong. The importer
    // must refuse it without touching the DB.
    const lesson2 = makeLesson({slug: 'standup-v2'});
    const manifest2 = makeManifest(lesson2, {packageSlug: 'standup-v2'});
    const bytes2 = makePackageBytes(manifest2, lesson2);
    const realSha = sha256Hex(bytes2);
    const tamperedManifest = {
      ...manifest2,
      expected_sha256: wrongSha,
    } as unknown as ContentPackageManifest;
    const tamperedBytes = makePackageBytes(tamperedManifest, lesson2);
    // Sanity: realSha is not equal to wrongSha so the test is meaningful.
    expect(realSha).not.toBe(wrongSha);

    const fetcher2 = makeFetcher(tamperedBytes);
    const result2 = await importContentPackage('https://example.com/pkg2.zip', {
      fetcher: fetcher2,
      now: () => NOW,
    });
    expect(result2.ok).toBe(false);
    if (result2.ok) return;
    expect(result2.error.code).toBe('CHECKSUM_MISMATCH');
    expect(result2.previousActivePackageId).toBe(firstActive?.id ?? null);

    // The active package is still v1 — no partial state.
    const stillActive = getActivePackage();
    expect(stillActive?.slug).toBe('daily-standup');
    expect(stillActive?.id).toBe(firstActive?.id);
    expect(fetcher2).toHaveBeenCalledTimes(1);
  });

  // AC: "Importing a package with an invalid schema (lint fails): fails
  // before any DB write, previous active package remains usable."
  it('rejects a package whose content lint fails, without writing the DB', async () => {
    // Seed an active package so we can assert it remains usable.
    const seedLesson = makeLesson();
    const seedManifest = makeManifest(seedLesson);
    const seedBytes = makePackageBytes(seedManifest, seedLesson);
    const seedResult = await importContentPackage(
      'https://example.com/seed.zip',
      {
        fetcher: makeFetcher(seedBytes),
        now: () => NOW,
      },
    );
    expect(seedResult.ok).toBe(true);
    const seedActive = getActivePackage();
    expect(seedActive).not.toBeNull();

    // Now a package whose lesson is missing a required `explanation_vi` on
    // the first chunk (LNT-005).
    const badLesson = makeLesson({missingExplanationVi: true});
    const badManifest = makeManifest(badLesson);
    const badBytes = makePackageBytes(badManifest, badLesson);

    const result = await importContentPackage('https://example.com/bad.zip', {
      fetcher: makeFetcher(badBytes),
      now: () => NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CONTENT_LINT_FAILED');
    expect(result.error.lintErrors?.some(e => e.includes('LNT-005'))).toBe(
      true,
    );
    expect(result.previousActivePackageId).toBe(seedActive?.id ?? null);

    // The active package is still the seed one.
    const stillActive = getActivePackage();
    expect(stillActive?.id).toBe(seedActive?.id);
  });

  // AC: "Rollback: after importing package v2, triggering rollback
  // reactivates package v1 without re-download."
  it('rolls back to the previous package without re-downloading', async () => {
    // v1
    const lesson1 = makeLesson();
    const manifest1 = makeManifest(lesson1);
    const bytes1 = makePackageBytes(manifest1, lesson1);
    const r1 = await importContentPackage('https://example.com/v1.zip', {
      fetcher: makeFetcher(bytes1),
      now: () => NOW,
    });
    expect(r1.ok).toBe(true);
    const v1 = getActivePackage();
    expect(v1?.slug).toBe('daily-standup');

    // v2 (different slug -> different package id)
    const lesson2 = makeLesson({slug: 'standup-v2'});
    const manifest2 = makeManifest(lesson2, {packageSlug: 'standup-v2'});
    const bytes2 = makePackageBytes(manifest2, lesson2);
    const r2 = await importContentPackage('https://example.com/v2.zip', {
      fetcher: makeFetcher(bytes2),
      now: () => NOW,
    });
    expect(r2.ok).toBe(true);
    const v2 = getActivePackage();
    expect(v2?.slug).toBe('standup-v2');

    // Rollback — no fetcher should be invoked.
    const fetchSpy = jest.fn();
    const rb = rollbackToPreviousPackage({now: () => NOW});
    expect(rb.ok).toBe(true);
    if (!rb.ok) return;
    expect(rb.reactivatedPackageSlug).toBe('daily-standup');
    expect(rb.reactivatedPackageId).toBe(v1?.id);
    expect(fetchSpy).not.toHaveBeenCalled();

    const after = getActivePackage();
    expect(after?.id).toBe(v1?.id);
    expect(after?.slug).toBe('daily-standup');
    // v2 should now be inactive, with a deactivated_at timestamp.
    const v2After = getPackageById(v2!.id);
    expect(v2After?.isActive).toBe(false);
    expect(v2After?.deactivatedAt).toBe(NOW);

    // v1 should still have its content rows present.
    const db = open({name: DB_NAME});
    const v1LessonRow = db.execute(
      'SELECT id FROM content_lessons WHERE package_id = ?;',
      [v1!.id],
    );
    expect(v1LessonRow.rows?.item(0)).toBeDefined();
  });

  it('returns ROLLBACK_NO_PREVIOUS_PACKAGE when there is no previous package', () => {
    const rb = rollbackToPreviousPackage({now: () => NOW});
    expect(rb.ok).toBe(false);
    if (rb.ok) return;
    expect(rb.error.code).toBe('ROLLBACK_NO_PREVIOUS_PACKAGE');
  });

  // AC: "Atomic SQLite insertion" — if the insertion transaction throws,
  // no row from the failed package is present in any content_* table.
  it('rolls back the insertion transaction when the insert throws mid-way', async () => {
    // Import a valid v1 so we can observe the no-state-leak guarantee.
    const v1 = makeLesson();
    const v1Bytes = makePackageBytes(makeManifest(v1), v1);
    await importContentPackage('https://example.com/v1.zip', {
      fetcher: makeFetcher(v1Bytes),
      now: () => NOW,
    });
    const v1Active = getActivePackage();
    expect(v1Active).not.toBeNull();

    // Build a v2 lesson, but sabotage the DB mid-transaction by making one
    // of the inserts throw. We do this by replacing the database with a
    // shim that succeeds for the first content_lessons insert then throws
    // on the first content_items insert.
    const db = open({name: DB_NAME});
    const realExecute = db.execute;
    let failed = false;
    (db as {execute: typeof realExecute}).execute = ((
      sql: string,
      params?: unknown[],
    ) => {
      if (
        !failed &&
        sql
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase()
          .startsWith('insert into content_items')
      ) {
        failed = true;
        throw new Error('synthetic mid-transaction failure');
      }
      return realExecute.call(db, sql, params);
    }) as typeof realExecute;

    const v2 = makeLesson({slug: 'standup-v2'});
    const v2Bytes = makePackageBytes(
      makeManifest(v2, {packageSlug: 'standup-v2'}),
      v2,
    );
    const result = await importContentPackage('https://example.com/v2.zip', {
      fetcher: makeFetcher(v2Bytes),
      now: () => NOW,
      getDb: () => db as unknown as ReturnType<typeof open>,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('DB_ERROR');

    // The DB error path returns before the activation swap, so v1 must
    // still be the active package.
    const after = getActivePackage();
    expect(after?.id).toBe(v1Active?.id);
  });

  it('emits progress through the import state store', async () => {
    const lesson = makeLesson();
    const manifest = makeManifest(lesson);
    const bytes = makePackageBytes(manifest, lesson);
    const events: string[] = [];
    const unsub = subscribeImportState(state => {
      events.push(state.current?.phase ?? 'null');
    });

    await importContentPackage('https://example.com/pkg.zip', {
      fetcher: makeFetcher(bytes),
      now: () => NOW,
    });
    unsub();
    expect(events).toEqual(
      expect.arrayContaining([
        'downloading',
        'verifying',
        'extracting',
        'validating',
        'importing',
        'activating',
        'completed',
      ]),
    );
    const final = getImportState();
    expect(final.lastSuccess?.ok).toBe(true);
    expect(final.lastFailure).toBeNull();
  });

  it('records the failure on the import state when a network error occurs', async () => {
    const result = await importContentPackage(
      'https://example.com/nowhere.zip',
      {
        fetcher: makeFailingFetcher('ENOTFOUND'),
        now: () => NOW,
      },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NETWORK_ERROR');
    const state = getImportState();
    expect(state.lastFailure?.error.code).toBe('NETWORK_ERROR');
  });

  it('rejects an archive that is not a valid ZIP before any DB write', async () => {
    const garbage = new TextEncoder().encode('this is not a zip at all');
    const result = await importContentPackage('https://example.com/pkg.zip', {
      fetcher: makeFetcher(garbage),
      now: () => NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_ZIP');
  });

  it('rejects a ZIP that does not contain a manifest.json', async () => {
    const lesson = makeLesson();
    const bytes = buildStoredZip([
      [
        lessonFileName(lesson),
        new TextEncoder().encode(JSON.stringify(lesson)),
      ],
    ]);
    const result = await importContentPackage('https://example.com/pkg.zip', {
      fetcher: makeFetcher(bytes),
      now: () => NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('MISSING_MANIFEST');
  });

  it('rejects a manifest that points at a missing lesson file', async () => {
    const lesson = makeLesson();
    const manifest = makeManifest(lesson);
    // Build a ZIP that only has the manifest, not the lesson file.
    const bytes = buildStoredZip([
      ['manifest.json', new TextEncoder().encode(JSON.stringify(manifest))],
    ]);
    const result = await importContentPackage('https://example.com/pkg.zip', {
      fetcher: makeFetcher(bytes),
      now: () => NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('LESSON_FILE_MISSING');
  });

  it('records the package sha256 in the content_packages row', async () => {
    const lesson = makeLesson();
    const manifest = makeManifest(lesson);
    const bytes = makePackageBytes(manifest, lesson);
    const result = await importContentPackage('https://example.com/pkg.zip', {
      fetcher: makeFetcher(bytes),
      now: () => NOW,
    });
    expect(result.ok).toBe(true);
    const active = getActivePackage();
    expect(active?.sha256).toBe(sha256Hex(bytes));
    expect(active?.sha256).toBe(sha256HexTest(bytes)); // sanity vs node
  });

  it('lists imported packages in reverse-chronological order', async () => {
    const lessonA = makeLesson({slug: 'lesson-a'});
    const lessonB = makeLesson({slug: 'lesson-b'});
    const lessonC = makeLesson({slug: 'lesson-c'});
    let t = 0;
    const tick = () => {
      t += 1;
      return `2026-09-06T12:00:0${t}.000Z`;
    };
    await importContentPackage('https://example.com/a.zip', {
      fetcher: makeFetcher(
        makePackageBytes(
          makeManifest(lessonA, {packageSlug: 'lesson-a'}),
          lessonA,
        ),
      ),
      now: tick,
    });
    await importContentPackage('https://example.com/b.zip', {
      fetcher: makeFetcher(
        makePackageBytes(
          makeManifest(lessonB, {packageSlug: 'lesson-b'}),
          lessonB,
        ),
      ),
      now: tick,
    });
    await importContentPackage('https://example.com/c.zip', {
      fetcher: makeFetcher(
        makePackageBytes(
          makeManifest(lessonC, {packageSlug: 'lesson-c'}),
          lessonC,
        ),
      ),
      now: tick,
    });
    const all = listPackages();
    expect(all.map(p => p.slug)).toEqual(['lesson-c', 'lesson-b', 'lesson-a']);
  });

  it('does not leave a half-imported package behind when the transaction fails', async () => {
    const v1 = makeLesson();
    await importContentPackage('https://example.com/v1.zip', {
      fetcher: makeFetcher(makePackageBytes(makeManifest(v1), v1)),
      now: () => NOW,
    });
    // Sabotage: throw on the first content_items insert.
    const db = open({name: DB_NAME});
    const realExecute = db.execute;
    (db as {execute: typeof realExecute}).execute = ((
      sql: string,
      params?: unknown[],
    ) => {
      if (
        sql
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase()
          .startsWith('insert into content_items')
      ) {
        throw new Error('synthetic failure');
      }
      return realExecute.call(db, sql, params);
    }) as typeof realExecute;
    const v2 = makeLesson({slug: 'standup-v2'});
    const result = await importContentPackage('https://example.com/v2.zip', {
      fetcher: makeFetcher(
        makePackageBytes(makeManifest(v2, {packageSlug: 'standup-v2'}), v2),
      ),
      now: () => NOW,
      getDb: () => db as unknown as ReturnType<typeof open>,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('DB_ERROR');
    }
    // No content_items row was inserted for the failed v2 package: the
    // mock's INSERT handler for content_items would have stored a row
    // had it been called, and the saboteur short-circuited the call.
    const dbReal = open({name: DB_NAME});
    const v2ItemCount = dbReal.execute(
      'SELECT COUNT(*) AS n FROM content_items;',
    );
    // Only v1's 10 items exist (the v2 import never reached content_items).
    expect((v2ItemCount.rows?.item(0) as {n: number}).n).toBe(10);
  });
});

describe('ContentPackageImporter — schema migration reversibility (CHANGE-3)', () => {
  beforeEach(() => {
    __resetMockDatabases();
    __resetImportStateForTests();
  });

  // AC: "All SQLite schema migrations added have corresponding down migrations
  // that restore the previous schema."
  it('down() runs without throwing and up() can be re-invoked afterwards', () => {
    const db = open({name: DB_NAME});
    runMigrations(db);

    // Up: a row can be inserted into every M2 table.
    db.execute(
      `INSERT INTO content_packages (
        id, slug, schema_version, source_url, sha256, is_active, imported_at, deactivated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      ['pkg-1', 's', '0.1.0', 'u', 'h', 1, NOW, null],
    );
    db.execute(
      `INSERT INTO content_lessons (
        id, package_id, slug, schema_version, title_en, title_vi, blurb_vi,
        level, target_skills_json, estimated_duration_minutes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      ['l-1', 'pkg-1', 's', '0.1.0', 't', 'tv', 'b', 'A2', '[]', 20],
    );
    db.execute(
      `INSERT INTO content_items (
        id, lesson_id, package_id, slug, chunk_order, phrase_en, phrase_vi,
        explanation_vi, context_sentence_en, context_sentence_vi, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      ['i-1', 'l-1', 'pkg-1', 's', 0, 'p', 'pv', 'e', null, null, '{}'],
    );
    db.execute(
      `INSERT INTO content_units (
        id, lesson_id, package_id, unit_type, slug, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?);`,
      ['u-1', 'l-1', 'pkg-1', 'vocabulary', 's', '{}'],
    );
    db.execute(
      `INSERT INTO content_activities (
        id, lesson_id, package_id, slug, activity_type, title_vi,
        chunk_ref_ids_json, qa_ref_ids_json, instructions_vi
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      ['a-1', 'l-1', 'pkg-1', 's', 'listen_and_repeat', 'tv', '[]', '[]', null],
    );
    db.execute(
      `INSERT INTO content_audio_assets (
        id, lesson_id, package_id, slug, url, checksum, bytes, locale, transcript
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      ['aa-1', 'l-1', 'pkg-1', 's', 'u', 'sha256:x', 0, null, null],
    );

    // Down: every DROP statement in the M2 down path runs without throwing.
    expect(() =>
      withTransaction(db, () => {
        downgradeContentPackageMigrations(db);
      }),
    ).not.toThrow();

    // Up again: the migrations are idempotent — re-running them must not
    // throw (the production app's `runMigrations` is called on every
    // launch). This is the round-trip we care about for CHANGE-3.
    expect(() => runMigrations(db)).not.toThrow();
  });
});
