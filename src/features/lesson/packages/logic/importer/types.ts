/**
 * Public type contract for the offline content package importer (SETE-107 / M2).
 *
 * Imported by services, the import-state hook, and the test suite. Holds no
 * runtime values — every symbol is either a type or a string-const enum that
 * is reused across modules.
 *
 * Type-only imports from the schema barrel (`import type`) are erased by
 * TypeScript so the RN bundle never pulls the schema module's top-level
 * `import {createHash} from 'crypto'` statement into runtime — runtime
 * validation lives in `packageLint.ts` which has no `crypto` dependency.
 */

import type {
  ContentPackageId,
  ContentPackageSummary,
} from '@core/contracts/contentContracts';

import type {
  AudioAsset,
  ContentVocabItem as VocabItem,
  GrammarPattern,
  Lesson,
  Manifest,
  SrsItem,
} from '../schema';

export type {ContentPackageId, ContentPackageSummary};
export type ContentLessonId = string;
export type ContentItemId = string;

/**
 * One entry the importer expects inside the package ZIP alongside
 * `manifest.json`. The manifest's `lessons[].file` field points at these.
 */
export type ExtractedPackageFile = {
  relativePath: string;
  bytes: Uint8Array;
};

export type ExtractedPackage = {
  manifest: Manifest;
  lessons: Lesson[];
};

/**
 * Stable error codes the UI / hook surface to the user. Each maps to one
 * failure path in the importer pipeline.
 */
export type ContentPackageImportErrorCode =
  | 'NETWORK_ERROR'
  | 'INVALID_ZIP'
  | 'CHECKSUM_MISMATCH'
  | 'MISSING_MANIFEST'
  | 'INVALID_MANIFEST'
  | 'LESSON_FILE_MISSING'
  | 'INVALID_LESSON'
  | 'CONTENT_LINT_FAILED'
  | 'DB_ERROR'
  | 'ROLLBACK_NO_PREVIOUS_PACKAGE';

export type ContentPackageImportError = {
  code: ContentPackageImportErrorCode;
  message: string;
  /** Lint rule ids that failed (only set when code = CONTENT_LINT_FAILED). */
  lintErrors?: string[];
};

export type ContentPackageImportPhase =
  | 'idle'
  | 'downloading'
  | 'verifying'
  | 'extracting'
  | 'validating'
  | 'importing'
  | 'activating'
  | 'completed'
  | 'failed';

export type ContentPackageImportProgress = {
  phase: ContentPackageImportPhase;
  /** 0..1 across the whole import; null when unknown (e.g. while downloading). */
  ratio: number | null;
  /** Human-readable status line, suitable for a UI label. */
  message: string;
  /** Set when phase = 'failed'. */
  error: ContentPackageImportError | null;
};

export type ContentPackageImportSuccess = {
  ok: true;
  packageId: ContentPackageId;
  packageSlug: string;
  schemaVersion: string;
  /** Number of lessons inserted into the DB. */
  lessonCount: number;
  /** Number of chunks inserted into content_items. */
  itemCount: number;
};

export type ContentPackageImportFailure = {
  ok: false;
  error: ContentPackageImportError;
  /**
   * The id of the previously active package, if any, so the UI can report
   * "rollback to <slug>" as an available action. The active package was not
   * changed on failure.
   */
  previousActivePackageId: ContentPackageId | null;
};

export type ContentPackageImportResult =
  | ContentPackageImportSuccess
  | ContentPackageImportFailure;

export type ContentPackageRollbackSuccess = {
  ok: true;
  /** The package that is now active (the previous one). */
  reactivatedPackageId: ContentPackageId;
  reactivatedPackageSlug: string;
};

export type ContentPackageRollbackFailure = {
  ok: false;
  error: ContentPackageImportError;
};

export type ContentPackageRollbackResult =
  | ContentPackageRollbackSuccess
  | ContentPackageRollbackFailure;

/**
 * Observable state of an in-flight (or most recent) import operation. The
 * `useContentPackageImport` hook reads this; tests read the same shape via
 * `getImportState()`. Mirrors the `useReviewState` / `useGamification` style
 * elsewhere in the app.
 */
export type ContentPackageImportState = {
  /** Current operation — null when nothing has ever run on this session. */
  current: ContentPackageImportProgress | null;
  /** Last successful import, or null. */
  lastSuccess: ContentPackageImportSuccess | null;
  /** Last failed import, or null. Cleared on next success. */
  lastFailure: ContentPackageImportFailure | null;
};

export type ContentPackageImportListener = (
  state: ContentPackageImportState,
) => void;

/** Lightweight listener type for import-progress subscriptions. */
export type ContentPackageProgressListener = (
  progress: ContentPackageImportProgress,
) => void;

/**
 * Return shape of the React hook the UI will use (not built in this task).
 * Re-exported so the import-service file can be the single import surface
 * for both imperative callers and the eventual React hook.
 */
export type UseContentPackageImport = () => ContentPackageImportState;

/**
 * Re-exported audio asset type so the rest of the importer does not have to
 * reach into the schema barrel directly.
 */
export type ContentAudioAssetMeta = AudioAsset;

export type ContentGrammarPattern = GrammarPattern;
export type ContentSrsItem = SrsItem;

/** Convenience aliases re-exported with the importer naming convention. */
export type {
  Lesson as ContentLesson,
  Manifest as ContentPackageManifest,
  VocabItem as ContentVocab,
  AudioAsset as ContentAudioAssetAlias,
};
