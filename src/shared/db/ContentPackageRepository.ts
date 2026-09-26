/**
 * Repository for the content-package tables added in SETE-107 / M2.
 *
 * Every function here is synchronous and works directly against the shared
 * `getDatabase()` connection. Callers that wrap multiple writes in a
 * transaction (the importer's atomic activation swap) use `withTransaction`
 * from `shared/db/database`; the repository functions stay transaction-agnostic
 * so they compose inside any transaction scope.
 *
 * Read functions return plain records shaped by `types.ts` so the rest of
 * the importer never has to think about column names.
 */

import {getDatabase} from './database';
import type {ContentPackageId, ContentPackageSummary} from '@modules/content';

type PackageRow = {
  id: string;
  slug: string;
  schema_version: string;
  source_url: string;
  sha256: string;
  is_active: number;
  imported_at: string;
  deactivated_at: string | null;
};

function mapPackageRow(row: PackageRow): ContentPackageSummary {
  return {
    id: row.id,
    slug: row.slug,
    schemaVersion: row.schema_version,
    sourceUrl: row.source_url,
    sha256: row.sha256,
    importedAt: row.imported_at,
    deactivatedAt: row.deactivated_at,
    isActive: row.is_active === 1,
    lessonCount: getLessonCount(row.id),
  };
}

function getLessonCount(packageId: ContentPackageId): number {
  const db = getDatabase();
  const result = db.execute(
    'SELECT COUNT(*) AS n FROM content_lessons WHERE package_id = ?;',
    [packageId],
  );
  const row = result.rows?.item(0) as {n: number} | undefined;
  return row?.n ?? 0;
}

export function insertPackageRecord(record: {
  id: ContentPackageId;
  slug: string;
  schemaVersion: string;
  sourceUrl: string;
  sha256: string;
  importedAt: string;
  isActive: boolean;
}): void {
  const db = getDatabase();
  db.execute(
    `INSERT INTO content_packages (
      id, slug, schema_version, source_url, sha256, is_active, imported_at, deactivated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      record.id,
      record.slug,
      record.schemaVersion,
      record.sourceUrl,
      record.sha256,
      record.isActive ? 1 : 0,
      record.importedAt,
      null,
    ],
  );
}

export function getActivePackage(): ContentPackageSummary | null {
  const db = getDatabase();
  const result = db.execute(
    'SELECT * FROM content_packages WHERE is_active = 1 LIMIT 1;',
  );
  const row = result.rows?.item(0) as PackageRow | undefined;
  if (!row) {
    return null;
  }
  return mapPackageRow(row);
}

/**
 * Most-recently deactivated package — the rollback target. We pick the
 * package that was deactivated last so rollback is a meaningful "undo last
 * import" operation, not an arbitrary history pick.
 */
export function getMostRecentInactivePackage(): ContentPackageSummary | null {
  const db = getDatabase();
  const result = db.execute(
    `SELECT * FROM content_packages
     WHERE is_active = 0 AND deactivated_at IS NOT NULL
     ORDER BY datetime(deactivated_at) DESC
     LIMIT 1;`,
  );
  const row = result.rows?.item(0) as PackageRow | undefined;
  if (!row) {
    return null;
  }
  return mapPackageRow(row);
}

export function getPackageById(
  id: ContentPackageId,
): ContentPackageSummary | null {
  const db = getDatabase();
  const result = db.execute('SELECT * FROM content_packages WHERE id = ?;', [
    id,
  ]);
  const row = result.rows?.item(0) as PackageRow | undefined;
  if (!row) {
    return null;
  }
  return mapPackageRow(row);
}

export function listPackages(): ContentPackageSummary[] {
  const db = getDatabase();
  const result = db.execute(
    'SELECT * FROM content_packages ORDER BY datetime(imported_at) DESC;',
  );
  const items: ContentPackageSummary[] = [];
  const rows = result.rows;
  if (!rows) {
    return items;
  }
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows.item(i) as PackageRow;
    items.push(mapPackageRow(row));
  }
  return items;
}

/**
 * Atomic activation swap: mark the new package active and the old one
 * inactive in one UPDATE pair. Called from inside a `withTransaction` block
 * so the two UPDATEs commit or roll back together.
 */
export function swapActivePackage(
  newActiveId: ContentPackageId,
  now: string,
): {previousActiveId: ContentPackageId | null} {
  const db = getDatabase();
  const previous = getActivePackage();
  if (previous && previous.id !== newActiveId) {
    db.execute(
      `UPDATE content_packages
       SET is_active = 0, deactivated_at = ?
       WHERE id = ?;`,
      [now, previous.id],
    );
  }
  db.execute(
    `UPDATE content_packages
     SET is_active = 1, deactivated_at = NULL
     WHERE id = ?;`,
    [newActiveId],
  );
  return {previousActiveId: previous?.id ?? null};
}

/**
 * Delete every content row tied to a package id. Used when an import is
 * aborted after the transaction commits but we still want a clean slate
 * (e.g. the user manually reverts). The importer itself does NOT call this
 * on the active package — the only delete path is a manual one.
 */
export function deletePackageContent(packageId: ContentPackageId): void {
  const db = getDatabase();
  db.execute('DELETE FROM content_audio_assets WHERE package_id = ?;', [
    packageId,
  ]);
  db.execute('DELETE FROM content_activities WHERE package_id = ?;', [
    packageId,
  ]);
  db.execute('DELETE FROM content_units WHERE package_id = ?;', [packageId]);
  db.execute('DELETE FROM content_items WHERE package_id = ?;', [packageId]);
  db.execute('DELETE FROM content_lessons WHERE package_id = ?;', [packageId]);
  db.execute('DELETE FROM content_packages WHERE id = ?;', [packageId]);
}
