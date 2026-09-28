import {Buffer} from 'buffer';
import {importContentPackage} from '../importer/ContentPackageImporter';
import {getActivePackage} from '../data/ContentPackageRepository';
import {constantTimeEqualHex} from '../importer/packageChecksum';
import {
  BUNDLED_PACKAGE_SLUG,
  BUNDLED_PACKAGE_SHA256,
  BUNDLED_PACKAGE_ZIP_BASE64,
} from './bundledPackageData';
import type {ContentPackageImportError} from '../importer/types';
import type {getDatabase} from '@shared/db/database';

export type ContentBootstrapResult =
  | {
      ok: true;
      status: 'installed' | 'already_active' | 'upgraded';
      packageId: string;
      lessonCount: number;
    }
  | {
      ok: false;
      status: 'failed';
      error: ContentPackageImportError;
      previousActivePackageId: string | null;
    };

export type ContentBootstrapDeps = {
  getDb?: typeof getDatabase;
  now?: () => string;
  bundledZipBytes?: Uint8Array;
  bundledSha256?: string;
  bundledSlug?: string;
  bundledVersion?: string;
};

/**
 * Returns the decoded Uint8Array of the bundled ZIP package.
 */
export function getBundledPackageZipBytes(
  overrideBytes?: Uint8Array,
): Uint8Array {
  if (overrideBytes) {
    return overrideBytes;
  }
  return new Uint8Array(Buffer.from(BUNDLED_PACKAGE_ZIP_BASE64, 'base64'));
}

/**
 * App-start content bootstrap orchestrator.
 * Checks active package in SQLite database.
 * If absent or sha256 differs (upgraded), installs/activates the bundled package.
 * Idempotent: repeated calls do nothing if the current active package is up to date.
 * Fail-safe: if validation/import fails during an upgrade, leaves previous active package usable.
 */
export async function bootstrapContentPackage(
  deps: ContentBootstrapDeps = {},
): Promise<ContentBootstrapResult> {
  const active = getActivePackage();
  const slug = deps.bundledSlug ?? BUNDLED_PACKAGE_SLUG;
  const sha256 = deps.bundledSha256 ?? BUNDLED_PACKAGE_SHA256;
  const zipBytes = getBundledPackageZipBytes(deps.bundledZipBytes);

  if (
    active &&
    active.slug === slug &&
    constantTimeEqualHex(active.sha256, sha256)
  ) {
    return {
      ok: true,
      status: 'already_active',
      packageId: active.id,
      lessonCount: active.lessonCount,
    };
  }

  const isUpgrade = active !== null;
  const sourceUrl = `bundled://${slug}.zip`;

  const importResult = await importContentPackage(sourceUrl, {
    fetcher: async () => ({
      ok: true,
      status: 200,
      body: zipBytes,
    }),
    getDb: deps.getDb,
    now: deps.now,
  });

  if (!importResult.ok) {
    return {
      ok: false,
      status: 'failed',
      error: importResult.error,
      previousActivePackageId: importResult.previousActivePackageId,
    };
  }

  return {
    ok: true,
    status: isUpgrade ? 'upgraded' : 'installed',
    packageId: importResult.packageId,
    lessonCount: importResult.lessonCount,
  };
}
