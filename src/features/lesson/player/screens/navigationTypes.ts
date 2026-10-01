export type CurriculumLessonRouteParams = {
  lessonId: string;
};

export type UnifiedLessonGenerationRouteParams = {
  jobId: string;
  confirmedText?: string;
  level?: string;
};

export type UnifiedLessonsPreviewRouteParams = undefined;

/** Canonical catalog route: no params (LING-149 TASK-007). */
export type CanonicalCatalogRouteParams = undefined;

export type CanonicalLessonPlayerRouteParams = {
  lessonId: string;
};

export type LessonCreationRouteParams = {
  /** Stable id for the persisted idempotency key (one per draft). */
  submissionId: string;
  initialSource?: 'text' | 'ocr' | 'youtube';
  initialText?: string;
};
