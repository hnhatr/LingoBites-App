import {z} from 'zod';

/**
 * Speaking-recording contracts (SETE-292 T5).
 *
 * Uploads use backend streaming: POST creates pending metadata and hands
 * back a same-API PUT upload URL; PUT streams the bytes through the server
 * so MIME, size and SHA-256 are validated before the row completes.
 */

export const RecordingStatusSchema = z.enum(['pending_upload', 'completed']);

export const CreateRecordingRequestSchema = z.object({
  mime_type: z.string().min(1).max(127),
  byte_size: z.number().int(),
  sha256: z.string().length(64),
});

export const RecordingViewSchema = z.object({
  recording_id: z.string().uuid(),
  status: RecordingStatusSchema,
  mime_type: z.string(),
  byte_size: z.number().int(),
  sha256: z.string(),
  upload_expires_at: z.string(),
  created_at: z.string(),
  completed_at: z.string().nullable(),
});

export const CreateRecordingSuccessResponseSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  recording: RecordingViewSchema,
  upload: z.object({
    method: z.literal('PUT'),
    url: z.string(),
    content_type: z.string(),
  }),
});

export const RecordingSuccessResponseSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  recording: RecordingViewSchema,
});

export const ListRecordingsSuccessResponseSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  recordings: z.array(RecordingViewSchema),
});

export const DeleteRecordingSuccessResponseSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  recording_id: z.string().uuid(),
  deleted: z.literal(true),
});

export type CreateRecordingRequest = z.infer<
  typeof CreateRecordingRequestSchema
>;
export type CreateRecordingSuccessResponse = z.infer<
  typeof CreateRecordingSuccessResponseSchema
>;
export type RecordingSuccessResponse = z.infer<
  typeof RecordingSuccessResponseSchema
>;
export type ListRecordingsSuccessResponse = z.infer<
  typeof ListRecordingsSuccessResponseSchema
>;
export type DeleteRecordingSuccessResponse = z.infer<
  typeof DeleteRecordingSuccessResponseSchema
>;
