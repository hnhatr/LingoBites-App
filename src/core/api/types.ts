export type ApiErrorCode =
  | 'VALIDATION_EMPTY_TEXT'
  | 'VALIDATION_TEXT_TOO_LONG'
  | 'IMAGE_TOO_LARGE'
  | 'OCR_NO_TEXT'
  | 'OCR_TIMEOUT'
  | 'OCR_PROVIDER_ERROR'
  | 'AI_TIMEOUT'
  | 'AI_INVALID_OUTPUT'
  | 'AI_PROVIDER_ERROR'
  | 'NETWORK_ERROR'
  | 'VALIDATION_MISSING_IDEMPOTENCY_KEY'
  | 'IDEMPOTENCY_CONFLICT'
  | 'AI_STAGE_PROVIDER_ERROR'
  | 'AI_STAGE_INVALID_OUTPUT'
  | 'AI_STAGE_TIMEOUT'
  | 'AI_JOB_TIMEOUT'
  | 'AI_FINAL_VALIDATION_FAILED'
  | 'AI_JOB_NOT_FOUND'
  | 'AI_POLL_GIVE_UP';

export type ApiErrorBody = {
  request_id: string;
  status: 'failed';
  error: {
    code: ApiErrorCode;
    message: string;
  };
  retryable?: boolean;
  warnings?: string[];
};

export type AIAnalyzeSuccessBody = {
  request_id: string;
  status: 'success';
  model: string;
  schema_version: 'ai-output-v1';
  prompt_version: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  data: unknown;
};

export type OCRSourceType = 'camera' | 'gallery';

export type AnalyzeSourceType = 'paste_text' | 'camera' | 'gallery';

export type OCRQualityBody = {
  text_length: number;
  text_length_bucket: string;
  line_count: number;
  has_english_signal: boolean;
  low_confidence: boolean;
};

export type OCRSuccessBody = {
  request_id: string;
  status: 'success';
  provider: string;
  ocr_raw_text: string;
  extracted_text: string;
  confidence?: number;
  quality: OCRQualityBody;
  warnings: string[];
};

export type OCRImageInput = {
  uri: string;
  fileName?: string;
  type?: string;
  width?: number;
  height?: number;
  sourceType: OCRSourceType;
};

export type OCRTextResult =
  | {
      ok: true;
      extractedText: string;
      ocrRawText: string;
      warnings: string[];
      quality: OCRQualityBody;
      confidence?: number;
    }
  | {ok: false; cancelled: true}
  | {
      ok: false;
      cancelled?: false;
      errorCode: ApiErrorCode;
      message: string;
      retryable?: boolean;
    };

export type AnalyzeTextRequestBody = {
  request_id: string;
  confirmed_text: string;
  level: string;
  native_language: string;
  source_type: 'paste_text' | 'camera' | 'gallery';
  prompt_version: string;
  client_context?: {
    platform?: 'ios' | 'android';
    app_version?: string;
    anonymous_user_id?: string;
  };
};

export type AnalysisJobStage = {
  name: string;
  status:
    | 'pending'
    | 'processing'
    | 'retrying'
    | 'completed'
    | 'failed'
    | 'skipped';
  attempts: number;
};

export type AnalysisJobProgressBody = {
  percent: number;
  current_stage: string | null;
  message: string | null;
  stages: AnalysisJobStage[];
};

export type CreateAnalysisJobSuccessBody = {
  request_id: string;
  analysis_id: string;
  status: string;
  created_at: string;
  status_url: string;
};

type AnalysisJobBaseBody = {
  analysis_id: string;
  progress: AnalysisJobProgressBody;
  partial_data: null;
  created_at: string;
  updated_at: string;
  expires_at: string;
};

export type AnalysisJobStatusBody =
  | (AnalysisJobBaseBody & {
      request_id: string;
      status: 'queued' | 'processing' | 'paused';
    })
  | (AnalysisJobBaseBody & {
      request_id: string;
      status: 'completed';
      model: string;
      schema_version: 'ai-output-v1';
      prompt_version: string;
      data: unknown;
    })
  | (AnalysisJobBaseBody & {
      status: 'failed';
      error: {
        code: ApiErrorCode;
        message: string;
        stage?: string;
        retryable?: boolean;
      };
    });
