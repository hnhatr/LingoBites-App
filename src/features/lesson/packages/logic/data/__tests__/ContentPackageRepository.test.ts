/**
 * Tests for the content-package repository (SETE-107 / M2).
 *
 * The repository is a thin SQL wrapper; these tests pin the row shapes and
 * the activation-swap invariants the importer depends on.
 */

import {__resetMockDatabases} from '../../../../../../../test-utils/sqliteMock';
import {open} from 'react-native-quick-sqlite';
import {DB_NAME} from '@core/db/constants';
import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {
  deletePackageContent,
  getActivePackage,
  getMostRecentInactivePackage,
  getPackageById,
  insertPackageRecord,
  listPackages,
  swapActivePackage,
} from '../ContentPackageRepository';

const NOW = '2026-09-06T12:00:00.000Z';

function setup() {
  __resetMockDatabases();
  const db = open({name: DB_NAME});
  resetDatabaseForTests(db);
  runMigrations(db);
  return db;
}

describe('ContentPackageRepository', () => {
  beforeEach(() => {
    setup();
  });

  it('returns null when no active package exists', () => {
    expect(getActivePackage()).toBeNull();
    expect(getMostRecentInactivePackage()).toBeNull();
  });

  it('inserts a package and reports it as active', () => {
    insertPackageRecord({
      id: 'pkg-1',
      slug: 'daily-standup',
      schemaVersion: '0.1.0',
      sourceUrl: 'https://example.com/pkg.zip',
      sha256: 'abc',
      importedAt: NOW,
      isActive: true,
    });
    const active = getActivePackage();
    expect(active).toMatchObject({
      id: 'pkg-1',
      slug: 'daily-standup',
      isActive: true,
      deactivatedAt: null,
    });
  });

  it('swapActivePackage marks the new package active and the old one inactive', () => {
    insertPackageRecord({
      id: 'pkg-1',
      slug: 'v1',
      schemaVersion: '0.1.0',
      sourceUrl: 'https://example.com/v1.zip',
      sha256: 'a',
      importedAt: NOW,
      isActive: true,
    });
    insertPackageRecord({
      id: 'pkg-2',
      slug: 'v2',
      schemaVersion: '0.1.0',
      sourceUrl: 'https://example.com/v2.zip',
      sha256: 'b',
      importedAt: NOW,
      isActive: false,
    });
    const {previousActiveId} = swapActivePackage('pkg-2', NOW);
    expect(previousActiveId).toBe('pkg-1');
    expect(getActivePackage()?.id).toBe('pkg-2');
    expect(getPackageById('pkg-1')?.isActive).toBe(false);
    expect(getPackageById('pkg-1')?.deactivatedAt).toBe(NOW);
  });

  it('swapActivePackage returns null previous id when no active package exists', () => {
    insertPackageRecord({
      id: 'pkg-1',
      slug: 'v1',
      schemaVersion: '0.1.0',
      sourceUrl: 'https://example.com/v1.zip',
      sha256: 'a',
      importedAt: NOW,
      isActive: false,
    });
    const {previousActiveId} = swapActivePackage('pkg-1', NOW);
    expect(previousActiveId).toBeNull();
    expect(getActivePackage()?.id).toBe('pkg-1');
  });

  it('getMostRecentInactivePackage returns the most recently deactivated one', () => {
    insertPackageRecord({
      id: 'pkg-1',
      slug: 'v1',
      schemaVersion: '0.1.0',
      sourceUrl: 'x',
      sha256: 'a',
      importedAt: '2026-01-01T00:00:00.000Z',
      isActive: true,
    });
    insertPackageRecord({
      id: 'pkg-2',
      slug: 'v2',
      schemaVersion: '0.1.0',
      sourceUrl: 'y',
      sha256: 'b',
      importedAt: '2026-02-01T00:00:00.000Z',
      isActive: false,
    });
    swapActivePackage('pkg-2', '2026-03-01T00:00:00.000Z');
    const mostRecent = getMostRecentInactivePackage();
    expect(mostRecent?.id).toBe('pkg-1');
  });

  it('listPackages returns packages ordered by imported_at desc', () => {
    insertPackageRecord({
      id: 'pkg-1',
      slug: 'v1',
      schemaVersion: '0.1.0',
      sourceUrl: 'x',
      sha256: 'a',
      importedAt: '2026-01-01T00:00:00.000Z',
      isActive: false,
    });
    insertPackageRecord({
      id: 'pkg-2',
      slug: 'v2',
      schemaVersion: '0.1.0',
      sourceUrl: 'y',
      sha256: 'b',
      importedAt: '2026-02-01T00:00:00.000Z',
      isActive: true,
    });
    const list = listPackages();
    expect(list.map(p => p.id)).toEqual(['pkg-2', 'pkg-1']);
  });

  it('deletePackageContent removes every content row tied to a package', () => {
    const db = open({name: DB_NAME});
    insertPackageRecord({
      id: 'pkg-1',
      slug: 'v1',
      schemaVersion: '0.1.0',
      sourceUrl: 'x',
      sha256: 'a',
      importedAt: NOW,
      isActive: true,
    });
    // Seed one row in each content_* table.
    db.execute(
      `INSERT INTO content_lessons (
        id, package_id, slug, schema_version, title_en, title_vi, blurb_vi,
        level, target_skills_json, estimated_duration_minutes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      ['l-1', 'pkg-1', 's', '0.1.0', 't', 'tv', 'b', 'A2', '[]', 10],
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
    deletePackageContent('pkg-1');
    const remainingLessons = db.execute(
      'SELECT COUNT(*) AS n FROM content_lessons WHERE package_id = ?;',
      ['pkg-1'],
    );
    const remainingPackages = db.execute(
      'SELECT COUNT(*) AS n FROM content_packages WHERE id = ?;',
      ['pkg-1'],
    );
    expect((remainingLessons.rows?.item(0) as {n: number}).n).toBe(0);
    expect((remainingPackages.rows?.item(0) as {n: number}).n).toBe(0);
  });
});
