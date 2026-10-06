import type {LessonOrigin, LessonSourceType} from '@core/schemas/lesson';

export type LessonCardView = {
  id: string;
  title: string;
  meta: string;
  blurb?: string;
};

/** Library source filter: every lesson, or one real `source_type`. */
export type LibrarySourceFilter = 'all' | LessonSourceType;

export const LIBRARY_SOURCE_FILTER_OPTIONS: ReadonlyArray<{
  key: LibrarySourceFilter;
  label: string;
}> = [
  {key: 'all', label: 'Tất cả'},
  {key: 'admin_text', label: 'Bài mẫu'},
  {key: 'learner_text', label: 'Văn bản'},
  {key: 'learner_ocr', label: 'Ảnh / OCR'},
  {key: 'youtube', label: 'YouTube'},
];

export type LibraryLessonCardView = {
  id: string;
  title: string;
  blurb: string;
  dateLabel: string;
  vocabularyCount: number;
  durationMin: number;
  sourceType: LessonSourceType;
  /** `admin` lessons are public; `learner` lessons are the user's own. */
  origin: LessonOrigin;
  /** The lesson is big enough for a quick-practice quiz. */
  practiceReady?: boolean;
};
