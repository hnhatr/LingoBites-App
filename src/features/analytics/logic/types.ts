import type {AnalyzeSourceType} from '@shared/api/types';

export type AnalyticsEventName =
  | 'app_opened'
  | 'input_method_selected'
  | 'image_selected'
  | 'text_entered'
  | 'ocr_started'
  | 'ocr_completed'
  | 'text_confirmed'
  | 'ai_analysis_started'
  | 'ai_analysis_completed'
  | 'result_viewed'
  | 'lesson_saved'
  | 'lesson_reopened'
  | 'unified_catalog_opened'
  | 'unified_lesson_opened'
  | 'unified_generation_started'
  | 'unified_generation_completed'
  | 'unified_generation_part_retry';

export type InputMethod = 'camera' | 'gallery' | 'paste_text';

export type ImageSizeCategory = 'small' | 'medium' | 'large';

export type AnalyticsProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

export type AnalyticsAdapter = {
  track: (event: AnalyticsEventName, properties?: AnalyticsProperties) => void;
};

export type AppOpenedProperties = {
  user_id?: string;
  app_version: string;
  platform: string;
};

export type InputMethodSelectedProperties = {
  method: InputMethod;
  screen: string;
};

export type ImageSelectedProperties = {
  source: 'camera' | 'gallery';
  image_size_category: ImageSizeCategory;
  has_permission: boolean;
};

export type TextEnteredProperties = {
  text_length_bucket: string;
};

export type OcrStartedProperties = {
  provider: string;
  source: 'camera' | 'gallery';
};

export type OcrCompletedProperties = {
  status: 'success' | 'failed';
  text_length_bucket?: string;
  confidence?: number;
  error_code?: string;
};

export type TextConfirmedProperties = {
  source_type: AnalyzeSourceType;
  text_length_bucket: string;
  edited_after_ocr: boolean;
};

export type AiAnalysisStartedProperties = {
  text_length_bucket: string;
  level: string;
  prompt_version: string;
};

export type AiAnalysisCompletedProperties = {
  status: 'success' | 'failed';
  duration_ms: number;
  model?: string;
  schema_valid?: boolean;
  sentence_count?: number;
  vocabulary_count?: number;
  grammar_count?: number;
  error_code?: string;
};

export type ResultViewedProperties = {
  lesson_id?: string;
  source_type: AnalyzeSourceType;
  sentence_count: number;
  vocabulary_count: number;
  grammar_count: number;
};

export type LessonSavedProperties = {
  lesson_id: string;
  source_type: AnalyzeSourceType;
  time_from_result_view_ms?: number;
};

export type LessonReopenedProperties = {
  lesson_id: string;
  days_since_created: number;
};
