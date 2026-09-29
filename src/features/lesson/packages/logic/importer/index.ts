/**
 * Public surface for the content package importer (SETE-107 / M2).
 *
 * The UI / hook layer imports from this file only. Nothing else in the
 * importer should be reached directly so a future migration to a different
 * implementation stays behind the same surface.
 */

export type {
  ContentPackageImportError,
  ContentPackageImportErrorCode,
  ContentPackageImportFailure,
  ContentPackageImportPhase,
  ContentPackageImportProgress,
  ContentPackageImportResult,
  ContentPackageImportState,
  ContentPackageImportSuccess,
  ContentPackageRollbackFailure,
  ContentPackageRollbackResult,
  ContentPackageRollbackSuccess,
  ContentPackageSummary,
  ContentPackageManifest,
  ContentLesson,
  ContentAudioAssetMeta,
  ContentGrammarPattern,
  ContentSrsItem,
  ContentVocab,
  ContentPackageId,
  ContentItemId,
  ExtractedPackage,
  ExtractedPackageFile,
  ContentPackageImportListener,
  ContentPackageProgressListener,
  UseContentPackageImport,
} from './types';

export {
  getImportState,
  subscribeImportState,
  subscribeImportProgress,
  __resetImportStateForTests,
} from './importState';

export {
  importContentPackage,
  rollbackToPreviousPackage,
  type ContentPackageImporterDeps,
  type PackageFetcher,
} from './ContentPackageImporter';

export {sha256Hex, constantTimeEqualHex} from './packageChecksum';

export {
  extractZip,
  extractZipSync,
  ZipReadError,
  type ExtractedZip,
  type ExtractedZipEntry,
} from './zipReader';

export {
  lintContentPackage,
  validateManifestShape,
  validateLessonShape,
  RUNTIME_CONTENT_SCHEMA_VERSION,
  type ContentLintResult,
} from './packageLint';
