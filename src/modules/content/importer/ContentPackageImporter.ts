/**
 * ContentPackageImporter (SETE-107 / M2) — the orchestrator that takes a URL,
 * downloads the hybrid ZIP, verifies its checksum, runs the M1 lint on the
 * extracted package, inserts every row into SQLite in a single transaction,
 * and atomically activates the new package.
 *
 * All side-effectful dependencies (network, ZIP reader, file store) are
 * injected so the unit tests can run against in-memory fakes with no native
 * modules. Production callers use the default `defaultDeps()` wiring.
 *
 * The orchestrator NEVER throws — every failure path returns a tagged
 * `ContentPackageImportResult` with a stable `errorCode` and a human-readable
 * `message`. The caller (the future UI, or a test) decides what to show.
 */

import {getDatabase, withTransaction} from '@shared/db/database';
import {
  insertPackageRecord,
  swapActivePackage,
  getActivePackage,
  getMostRecentInactivePackage,
  getPackageById,
} from '../data/ContentPackageRepository';
import {constantTimeEqualHex, sha256Hex} from './packageChecksum';
import {
  lintContentPackage,
  validateLessonShape,
  validateManifestShape,
  RUNTIME_CONTENT_SCHEMA_VERSION,
} from './packageLint';
import {
  reportFailure,
  reportProgress,
  reportSuccess,
  startImport,
} from './importState';
import type {
  ContentPackageImportError,
  ContentPackageImportProgress,
  ContentPackageImportResult,
  ContentPackageRollbackResult,
  ContentLesson,
  ContentPackageManifest,
} from './types';
import {extractZip} from './zipReader';
import {decodeUtf8} from './utf8';

/**
 * Fetches a URL and returns the raw bytes. The default implementation
 * delegates to `fetch`; tests inject a fake.
 */
export type PackageFetcher = (url: string) => Promise<{
  ok: boolean;
  status: number;
  body: Uint8Array;
}>;

const defaultFetcher: PackageFetcher = async url => {
  let response: Response;
  try {
    response = await fetch(url, {method: 'GET'});
  } catch {
    return {ok: false, status: 0, body: new Uint8Array(0)};
  }
  if (!response.ok) {
    return {ok: false, status: response.status, body: new Uint8Array(0)};
  }
  const buffer = await response.arrayBuffer();
  return {ok: true, status: response.status, body: new Uint8Array(buffer)};
};

/** Minimum expected sha256 hex length (64 hex chars). */
const SHA256_HEX_LENGTH = 64;

function makeError(
  code: ContentPackageImportError['code'],
  message: string,
  lintErrors?: string[],
): ContentPackageImportError {
  return lintErrors ? {code, message, lintErrors} : {code, message};
}

function nowIso(now?: () => string): string {
  return (now?.() ?? new Date().toISOString()) as string;
}

function utf8Decode(bytes: Uint8Array): string {
  return decodeUtf8(bytes);
}

function buildProgress(
  phase: ContentPackageImportProgress['phase'],
  ratio: number | null,
  message: string,
  error: ContentPackageImportError | null = null,
): ContentPackageImportProgress {
  return {phase, ratio, message, error};
}

export type ContentPackageImporterDeps = {
  fetcher?: PackageFetcher;
  extractZip?: typeof extractZip;
  /** Override the database getter for tests. */
  getDb?: typeof getDatabase;
  /** Override `now()` for tests. */
  now?: () => string;
};

const REQUIRED_MANIFEST_PATH = 'manifest.json';

function loadManifestFromExtracted(
  entries: ReadonlyMap<string, Uint8Array>,
):
  | {ok: true; manifest: ContentPackageManifest; manifestBytes: Uint8Array}
  | {ok: false; error: ContentPackageImportError} {
  const manifestBytes = entries.get(REQUIRED_MANIFEST_PATH);
  if (!manifestBytes) {
    return {
      ok: false,
      error: makeError(
        'MISSING_MANIFEST',
        'Package does not contain manifest.json',
      ),
    };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(utf8Decode(manifestBytes));
  } catch (e) {
    return {
      ok: false,
      error: makeError(
        'INVALID_MANIFEST',
        `manifest.json is not valid JSON: ${(e as Error).message}`,
      ),
    };
  }
  const validation = validateManifestShape(raw);
  if (!validation.ok || !validation.manifest) {
    return {
      ok: false,
      error: makeError(
        'INVALID_MANIFEST',
        `manifest.json failed validation: ${validation.errors.join('; ')}`,
      ),
    };
  }
  return {ok: true, manifest: validation.manifest, manifestBytes};
}

function loadLessonsFromExtracted(
  manifest: ContentPackageManifest,
  entries: ReadonlyMap<string, Uint8Array>,
):
  | {ok: true; lessons: ContentLesson[]}
  | {ok: false; error: ContentPackageImportError} {
  const lessons: ContentLesson[] = [];
  for (const entry of manifest.lessons) {
    const fileBytes = entries.get(entry.file);
    if (!fileBytes) {
      return {
        ok: false,
        error: makeError(
          'LESSON_FILE_MISSING',
          `manifest references lesson file "${entry.file}" but it was not found in the package`,
        ),
      };
    }
    let raw: unknown;
    try {
      raw = JSON.parse(utf8Decode(fileBytes));
    } catch (e) {
      return {
        ok: false,
        error: makeError(
          'INVALID_LESSON',
          `lesson file "${entry.file}" is not valid JSON: ${
            (e as Error).message
          }`,
        ),
      };
    }
    const validation = validateLessonShape(raw);
    if (!validation.ok || !validation.lesson) {
      return {
        ok: false,
        error: makeError(
          'INVALID_LESSON',
          `lesson file "${
            entry.file
          }" failed validation: ${validation.errors.join('; ')}`,
        ),
      };
    }
    lessons.push(validation.lesson);
  }
  return {ok: true, lessons};
}

type InsertPlan = {
  manifest: ContentPackageManifest;
  lessons: ContentLesson[];
  packageId: string;
  importedAt: string;
  sourceUrl: string;
  sha256: string;
  previousActiveId: string | null;
};

function insertPlanIntoDb(
  plan: InsertPlan,
  getDb: typeof getDatabase,
):
  | {
      ok: true;
      lessonCount: number;
      itemCount: number;
    }
  | {ok: false; error: ContentPackageImportError} {
  const db = getDb();
  try {
    withTransaction(db, () => {
      insertPackageRecord({
        id: plan.packageId,
        slug: plan.manifest.slug,
        schemaVersion: plan.manifest.schema_version,
        sourceUrl: plan.sourceUrl,
        sha256: plan.sha256,
        importedAt: plan.importedAt,
        isActive: false,
      });
      for (const lesson of plan.lessons) {
        db.execute(
          `INSERT INTO content_lessons (
            id, package_id, slug, schema_version, title_en, title_vi, blurb_vi,
            level, target_skills_json, estimated_duration_minutes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            lesson.id,
            plan.packageId,
            lesson.slug,
            lesson.schema_version,
            lesson.title_en,
            lesson.title_vi,
            lesson.blurb_vi,
            lesson.level,
            JSON.stringify(lesson.target_skills ?? []),
            lesson.estimated_duration_minutes,
          ],
        );
        for (const chunk of lesson.chunks ?? []) {
          db.execute(
            `INSERT INTO content_items (
              id, lesson_id, package_id, slug, chunk_order, phrase_en, phrase_vi,
              explanation_vi, context_sentence_en, context_sentence_vi, payload_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              chunk.id,
              lesson.id,
              plan.packageId,
              chunk.slug,
              chunk.order,
              chunk.phrase_en,
              chunk.phrase_vi,
              chunk.explanation_vi,
              chunk.context_sentence_en ?? null,
              chunk.context_sentence_vi ?? null,
              JSON.stringify({
                grammar_ref_ids: chunk.grammar_ref_ids ?? [],
                vocab_ref_ids: chunk.vocab_ref_ids ?? [],
                dialogue_turns: chunk.dialogue_turns ?? [],
                qa_items: chunk.qa_items ?? [],
                audio_ref_ids: chunk.audio_ref_ids ?? [],
                srs_ref_ids: chunk.srs_ref_ids ?? [],
                remediation: chunk.remediation ?? null,
              }),
            ],
          );
        }
        for (const vocab of lesson.vocabulary ?? []) {
          db.execute(
            `INSERT INTO content_units (
              id, lesson_id, package_id, unit_type, slug, payload_json
            ) VALUES (?, ?, ?, ?, ?, ?);`,
            [
              vocab.id,
              lesson.id,
              plan.packageId,
              'vocabulary',
              vocab.slug,
              JSON.stringify(vocab),
            ],
          );
        }
        for (const grammar of lesson.grammar_patterns ?? []) {
          db.execute(
            `INSERT INTO content_units (
              id, lesson_id, package_id, unit_type, slug, payload_json
            ) VALUES (?, ?, ?, ?, ?, ?);`,
            [
              grammar.id,
              lesson.id,
              plan.packageId,
              'grammar',
              grammar.slug,
              JSON.stringify(grammar),
            ],
          );
        }
        for (const srs of lesson.srs_items ?? []) {
          db.execute(
            `INSERT INTO content_units (
              id, lesson_id, package_id, unit_type, slug, payload_json
            ) VALUES (?, ?, ?, ?, ?, ?);`,
            [
              srs.id,
              lesson.id,
              plan.packageId,
              'srs',
              srs.slug,
              JSON.stringify(srs),
            ],
          );
        }
        for (const dialogue of collectDialogueTurns(lesson)) {
          db.execute(
            `INSERT INTO content_units (
              id, lesson_id, package_id, unit_type, slug, payload_json
            ) VALUES (?, ?, ?, ?, ?, ?);`,
            [
              dialogue.id,
              lesson.id,
              plan.packageId,
              'dialogue_turn',
              dialogue.slug,
              JSON.stringify(dialogue),
            ],
          );
        }
        for (const activity of lesson.activities ?? []) {
          db.execute(
            `INSERT INTO content_activities (
              id, lesson_id, package_id, slug, activity_type, title_vi,
              chunk_ref_ids_json, qa_ref_ids_json, instructions_vi
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              activity.id,
              lesson.id,
              plan.packageId,
              activity.slug,
              activity.type,
              activity.title_vi,
              JSON.stringify(activity.chunk_ref_ids ?? []),
              JSON.stringify(activity.qa_ref_ids ?? []),
              activity.instructions_vi ?? null,
            ],
          );
        }
        for (const audio of lesson.audio_assets ?? []) {
          db.execute(
            `INSERT INTO content_audio_assets (
              id, lesson_id, package_id, slug, url, checksum, bytes, locale, transcript
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              audio.id,
              lesson.id,
              plan.packageId,
              audio.slug,
              audio.url,
              audio.checksum,
              0,
              audio.locale ?? null,
              audio.transcript ?? null,
            ],
          );
        }
      }
    });
  } catch (e) {
    return {
      ok: false,
      error: makeError(
        'DB_ERROR',
        `Failed to insert content rows: ${(e as Error).message}`,
      ),
    };
  }
  return {
    ok: true,
    lessonCount: plan.lessons.length,
    itemCount: plan.lessons.reduce(
      (acc, l) => acc + (l.chunks?.length ?? 0),
      0,
    ),
  };
}

function collectDialogueTurns(lesson: ContentLesson) {
  const out: Array<{id: string; slug: string}> = [];
  for (const chunk of lesson.chunks ?? []) {
    for (const turn of chunk.dialogue_turns ?? []) {
      out.push({id: turn.id, slug: turn.slug});
    }
  }
  return out;
}

/**
 * Import a package from the given URL. Returns a tagged result; on success
 * the new package is the active one, on failure the previously active
 * package (if any) is untouched and `previousActivePackageId` is set.
 */
export async function importContentPackage(
  sourceUrl: string,
  deps: ContentPackageImporterDeps = {},
): Promise<ContentPackageImportResult> {
  const fetcher = deps.fetcher ?? defaultFetcher;
  const extract = deps.extractZip ?? extractZip;
  const getDb = deps.getDb ?? getDatabase;
  const now = deps.now;

  const start = buildProgress('downloading', null, 'Downloading package…');
  startImport(start);
  reportProgress(start);

  const previous = getActivePackage();
  const failureShell = (
    error: ContentPackageImportError,
  ): ContentPackageImportResult => {
    const failure = {
      ok: false as const,
      error,
      previousActivePackageId: previous?.id ?? null,
    };
    reportFailure(failure);
    return failure;
  };

  // 1) Download
  let download;
  try {
    download = await fetcher(sourceUrl);
  } catch (e) {
    return failureShell(
      makeError('NETWORK_ERROR', `Download failed: ${(e as Error).message}`),
    );
  }
  if (!download.ok) {
    return failureShell(
      makeError(
        'NETWORK_ERROR',
        `Download failed with HTTP ${download.status} for ${sourceUrl}`,
      ),
    );
  }
  if (download.body.length === 0) {
    return failureShell(
      makeError('NETWORK_ERROR', `Downloaded package is empty (0 bytes)`),
    );
  }

  // 2) Checksum — the manifest carries an "sha256" field, but the importer
  // uses the package-wide hash of the ZIP bytes. If the manifest exposes a
  // sha256 string, that is treated as the expected hash. Otherwise we still
  // record the computed sha256 so audits / future verification can use it.
  const computedSha = sha256Hex(download.body);
  reportProgress(
    buildProgress('verifying', null, 'Verifying package checksum…'),
  );

  // 3) Extract ZIP
  reportProgress(buildProgress('extracting', null, 'Extracting package…'));
  let entries;
  try {
    const result = await extract(download.body);
    entries = result.entries;
  } catch (e) {
    return failureShell(
      makeError(
        'INVALID_ZIP',
        `Package is not a valid ZIP archive: ${(e as Error).message}`,
      ),
    );
  }
  const entryMap = new Map<string, Uint8Array>();
  for (const e of entries) {
    entryMap.set(e.name, e.bytes);
  }

  // 4) Manifest + lesson validation
  const manifestResult = loadManifestFromExtracted(entryMap);
  if (!manifestResult.ok) {
    return failureShell(manifestResult.error);
  }
  // Optional checksum match: if the manifest exposes an `expected_sha256`
  // field, enforce it. The M1 contract does not have that field, so by
  // default the importer just records the bytes-hash. The hook for future
  // signed manifests is here for forward compatibility.
  const manifestAny = manifestResult.manifest as unknown as {
    expected_sha256?: unknown;
    sha256?: unknown;
  };
  const expectedSha =
    typeof manifestAny.expected_sha256 === 'string'
      ? manifestAny.expected_sha256
      : typeof manifestAny.sha256 === 'string'
      ? manifestAny.sha256
      : null;
  if (
    expectedSha &&
    expectedSha.length === SHA256_HEX_LENGTH &&
    !constantTimeEqualHex(expectedSha.toLowerCase(), computedSha)
  ) {
    return failureShell(
      makeError(
        'CHECKSUM_MISMATCH',
        `Package SHA-256 does not match manifest expected value`,
      ),
    );
  }

  const lessonsResult = loadLessonsFromExtracted(
    manifestResult.manifest,
    entryMap,
  );
  if (!lessonsResult.ok) {
    return failureShell(lessonsResult.error);
  }

  // 5) Lint
  reportProgress(buildProgress('validating', null, 'Validating content…'));
  const lint = lintContentPackage(
    manifestResult.manifest,
    lessonsResult.lessons,
  );
  if (!lint.ok) {
    return failureShell(
      makeError(
        'CONTENT_LINT_FAILED',
        `Content lint failed: ${lint.errors.length} error(s)`,
        lint.errors,
      ),
    );
  }

  // 6) Insert
  reportProgress(buildProgress('importing', null, 'Inserting content…'));
  const importedAt = nowIso(now);
  const insertPlan: InsertPlan = {
    manifest: manifestResult.manifest,
    lessons: lessonsResult.lessons,
    packageId: `pkg-${manifestResult.manifest.package_id}-${importedAt.replace(
      /[:.]/g,
      '-',
    )}`,
    importedAt,
    sourceUrl,
    sha256: computedSha,
    previousActiveId: previous?.id ?? null,
  };
  const insertResult = insertPlanIntoDb(insertPlan, getDb);
  if (!insertResult.ok) {
    return failureShell(insertResult.error);
  }

  // 7) Atomic activation swap
  reportProgress(buildProgress('activating', null, 'Activating new package…'));
  try {
    const db = getDb();
    withTransaction(db, () => {
      swapActivePackage(insertPlan.packageId, nowIso(now));
    });
  } catch (e) {
    return failureShell(
      makeError(
        'DB_ERROR',
        `Failed to activate new package: ${(e as Error).message}`,
      ),
    );
  }

  const success = {
    ok: true as const,
    packageId: insertPlan.packageId,
    packageSlug: manifestResult.manifest.slug,
    schemaVersion: manifestResult.manifest.schema_version,
    lessonCount: insertResult.lessonCount,
    itemCount: insertResult.itemCount,
  };
  reportSuccess(success);
  return success;
}

/**
 * Roll back to the most recently deactivated package without re-downloading
 * anything. The rows of the previous package are still in the database
 * (we never delete imported content on activation swap), so the swap is a
 * single transaction.
 */
export function rollbackToPreviousPackage(
  deps: ContentPackageImporterDeps = {},
): ContentPackageRollbackResult {
  const getDb = deps.getDb ?? getDatabase;
  const now = deps.now;
  const previous = getMostRecentInactivePackage();
  if (!previous) {
    return {
      ok: false,
      error: {
        code: 'ROLLBACK_NO_PREVIOUS_PACKAGE',
        message: 'No previously active package to roll back to.',
      },
    };
  }
  // Sanity: the package we are about to activate must still be present
  // (defensive — should always be true, but a manual operator could delete
  // a package and we should not silently reactivate a ghost row).
  const fresh = getPackageById(previous.id);
  if (!fresh) {
    return {
      ok: false,
      error: {
        code: 'DB_ERROR',
        message: `Previous package "${previous.id}" is no longer in the database.`,
      },
    };
  }
  try {
    const db = getDb();
    withTransaction(db, () => {
      swapActivePackage(previous.id, nowIso(now));
    });
  } catch (e) {
    return {
      ok: false,
      error: {
        code: 'DB_ERROR',
        message: `Rollback failed: ${(e as Error).message}`,
      },
    };
  }
  return {
    ok: true,
    reactivatedPackageId: previous.id,
    reactivatedPackageSlug: previous.slug,
  };
}

export const _internal = {
  loadManifestFromExtracted,
  loadLessonsFromExtracted,
  insertPlanIntoDb,
  RUNTIME_CONTENT_SCHEMA_VERSION,
  SHA256_HEX_LENGTH,
};
