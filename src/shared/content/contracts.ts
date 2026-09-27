export type ContentMasteryState =
  | 'new'
  | 'learning'
  | 'reviewing'
  | 'mastered'
  | 'relearning';

export type ContentPackageId = string;

export type ContentPackageSummary = {
  id: ContentPackageId;
  slug: string;
  schemaVersion: string;
  sourceUrl: string;
  sha256: string;
  importedAt: string;
  deactivatedAt: string | null;
  isActive: boolean;
  lessonCount: number;
};

