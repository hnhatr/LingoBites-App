import {z} from 'zod';

export const SCHEMA_VERSION = 'youtube-transcript-v1' as const;

export const YOUTUBE_MAX_SEGMENTS = 400;
export const YOUTUBE_MAX_SEGMENT_CHAR_COUNT = 240;
export const YOUTUBE_SEGMENT_SILENCE_GAP_MS = 700;
export const YOUTUBE_MAX_DURATION_SECONDS = 900;

export const YouTubeErrorCodeSchema = z.enum([
  'YOUTUBE_INVALID_URL',
  'YOUTUBE_VIDEO_NOT_FOUND',
  'YOUTUBE_NOT_EMBEDDABLE',
  'YOUTUBE_TOO_LONG',
  'YOUTUBE_LIVE_UNSUPPORTED',
  'YOUTUBE_LANGUAGE_UNSUPPORTED',
  'TRANSCRIPT_UNAVAILABLE',
  'TRANSCRIPT_SOURCE_BLOCKED',
  'TRANSCRIPT_UNPARSABLE',
  'TRANSCRIPT_TOO_LARGE',
  // SETE-290: backend fails the job when enrichment cannot fill every
  // segment's vi/ipa — mirrors api-server YouTubeErrorCodeSchema.
  'ENRICHMENT_FAILED',
  'ENRICHMENT_AI_UNAVAILABLE',
  'ENRICHMENT_AI_QUOTA_EXCEEDED',
  'RATE_LIMIT_EXCEEDED',
]);

export type YouTubeErrorCode = z.infer<typeof YouTubeErrorCodeSchema>;

export const RawCueSchema = z.object({
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative().nullable(),
  text: z.string(),
});

export type RawCue = z.infer<typeof RawCueSchema>;

export const TranscriptSourceSchema = z.enum(['auto_caption', 'manual']);

export type TranscriptSource = z.infer<typeof TranscriptSourceSchema>;

export const YouTubeVideoSchema = z.object({
  id: z.string().length(11),
  title: z.string(),
  channel_title: z.string(),
  duration_seconds: z.number().int().nonnegative(),
  language: z.string(),
  embeddable: z.boolean(),
});

export type YouTubeVideo = z.infer<typeof YouTubeVideoSchema>;

export const YouTubeSegmentSchema = z
  .object({
    id: z.string(),
    index: z.number().int().nonnegative(),
    start_ms: z.number().int().nonnegative(),
    end_ms: z.number().int().nonnegative(),
    en: z.string(),
    vi: z.string(),
    ipa: z.string(),
  })
  .refine(segment => segment.end_ms > segment.start_ms, {
    message: 'end_ms must be greater than start_ms',
    path: ['end_ms'],
  });

export type YouTubeSegment = z.infer<typeof YouTubeSegmentSchema>;

export const YouTubeTranscriptSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  video: YouTubeVideoSchema,
  transcript_source: TranscriptSourceSchema,
  segments: z.array(YouTubeSegmentSchema).max(YOUTUBE_MAX_SEGMENTS),
  warnings: z.array(z.string()),
});

export type YouTubeTranscript = z.infer<typeof YouTubeTranscriptSchema>;

export const CreateYouTubeTranscriptRequestSchema = z.object({
  url: z.string().min(1),
  transcript: z
    .object({
      cues: z.array(RawCueSchema),
    })
    .optional(),
});

export type CreateYouTubeTranscriptRequest = z.infer<
  typeof CreateYouTubeTranscriptRequestSchema
>;

export const YouTubeJobStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
]);

export type YouTubeJobStatus = z.infer<typeof YouTubeJobStatusSchema>;

export const YouTubeJobProgressSchema = z.object({
  percent: z.number(),
  stage: z.string().nullable(),
});

export type YouTubeJobProgress = z.infer<typeof YouTubeJobProgressSchema>;

export const CreateYouTubeTranscriptResponseSchema = z.object({
  request_id: z.string(),
  job_id: z.string(),
  status: z.enum(['pending', 'processing']),
  progress: YouTubeJobProgressSchema,
});

export type CreateYouTubeTranscriptResponse = z.infer<
  typeof CreateYouTubeTranscriptResponseSchema
>;

export const YouTubeTranscriptErrorSchema = z.object({
  code: YouTubeErrorCodeSchema,
  message: z.string(),
});

export type YouTubeTranscriptError = z.infer<
  typeof YouTubeTranscriptErrorSchema
>;

export const GetYouTubeTranscriptResponseSchema = z.object({
  request_id: z.string(),
  status: YouTubeJobStatusSchema,
  progress: YouTubeJobProgressSchema,
  data: YouTubeTranscriptSchema.optional(),
  error: YouTubeTranscriptErrorSchema.optional(),
});

export type GetYouTubeTranscriptResponse = z.infer<
  typeof GetYouTubeTranscriptResponseSchema
>;

export type ValidationResult<T> =
  | {valid: true; data: T}
  | {valid: false; error: string};

function formatValidationError(error: z.ZodError): string {
  const first = error.issues[0];
  return first
    ? `${first.path.join('.') || '(root)'}: ${first.message}`
    : 'Invalid YouTube transcript payload';
}

export function validateYouTubeTranscript(
  raw: unknown,
): ValidationResult<YouTubeTranscript> {
  const parsed = YouTubeTranscriptSchema.safeParse(raw);
  if (parsed.success) {
    return {valid: true, data: parsed.data};
  }
  return {valid: false, error: formatValidationError(parsed.error)};
}

export function validateCreateYouTubeTranscriptRequest(
  raw: unknown,
): ValidationResult<CreateYouTubeTranscriptRequest> {
  const parsed = CreateYouTubeTranscriptRequestSchema.safeParse(raw);
  if (parsed.success) {
    return {valid: true, data: parsed.data};
  }
  return {valid: false, error: formatValidationError(parsed.error)};
}

export function validateGetYouTubeTranscriptResponse(
  raw: unknown,
): ValidationResult<GetYouTubeTranscriptResponse> {
  const parsed = GetYouTubeTranscriptResponseSchema.safeParse(raw);
  if (parsed.success) {
    return {valid: true, data: parsed.data};
  }
  return {valid: false, error: formatValidationError(parsed.error)};
}
