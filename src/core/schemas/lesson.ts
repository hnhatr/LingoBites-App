import {z} from 'zod';

/**
 * Canonical lesson contract mirror (LING-149 TASK-007, AD-009).
 *
 * The Server owns this contract (`LingoBites-Server`
 * `src/modules/canonicalLesson/model/` on `integration/LING-149`); this
 * module mirrors it instead of redefining the shapes. Bump
 * `LESSON_CONTRACT_VERSION` only together with the Server. A `contract_version`
 * mismatch surfaces an "update the app" state and is never parsed leniently.
 *
 * Pinned fixture revision: `ling-149-task-001-r1` (TASK-001). The contract
 * tests under `__tests__` parse byte-identical copies of the Server fixtures,
 * so any drift fails the build.
 */

export const LESSON_CONTRACT_VERSION = 1;

export const LESSON_CONTRACT_FIXTURE_REVISION = 'ling-149-task-001-r1';

export const LessonContractVersionSchema = z.literal(LESSON_CONTRACT_VERSION);

export const LessonOriginValues = ['admin', 'learner'] as const;

export const LessonOriginSchema = z.enum(LessonOriginValues);

export type LessonOrigin = z.infer<typeof LessonOriginSchema>;

export const LessonSourceTypeValues = [
  'admin_text',
  'learner_text',
  'learner_ocr',
  'youtube',
] as const;

export const LessonSourceTypeSchema = z.enum(LessonSourceTypeValues);

export type LessonSourceType = z.infer<typeof LessonSourceTypeSchema>;

export const CanonicalLessonBlockTypeValues = [
  'text',
  'example',
  'vocabulary',
  'media',
  'context',
  'grammar',
  'activity',
] as const;

export const CanonicalLessonBlockTypeSchema = z.enum(
  CanonicalLessonBlockTypeValues,
);

export type CanonicalLessonBlockType = z.infer<
  typeof CanonicalLessonBlockTypeSchema
>;

export const NonBlankTextSchema = z
  .string()
  .refine(value => value.trim().length > 0, {
    message: 'must not be blank',
  });

export const LessonSentenceSchema = z
  .object({
    id: z.string().uuid(),
    position: z.number().int().min(0),
    text_en: NonBlankTextSchema,
    text_vi: NonBlankTextSchema,
    ipa: NonBlankTextSchema,
    start_ms: z.number().int().min(0).nullable(),
    end_ms: z.number().int().nullable(),
  })
  .strict();

export type LessonSentence = z.infer<typeof LessonSentenceSchema>;

export const LessonUnitSchema = z
  .object({
    course_id: z.string().uuid(),
    course_title: z.string(),
    level_id: z.string().uuid(),
    level_title: z.string(),
    unit_id: z.string().uuid(),
    unit_title: z.string(),
    unit_position: z.number().int(),
    lesson_position: z.number().int(),
  })
  .strict();

export type LessonUnit = z.infer<typeof LessonUnitSchema>;

export const LessonYoutubeSchema = z
  .object({
    video_id: z.string().min(1),
    duration_ms: z.number().int().min(0),
  })
  .strict();

export type LessonYoutube = z.infer<typeof LessonYoutubeSchema>;

export const LessonBlockSchema = z
  .object({
    id: z.string().uuid(),
    type: CanonicalLessonBlockTypeSchema,
    position: z.number().int().min(0),
    title: z.string().nullable(),
    data: z.record(z.string(), z.unknown()),
  })
  .strict();

export type LessonBlock = z.infer<typeof LessonBlockSchema>;

export const AnalysisVocabularyItemSchema = z
  .object({
    id: z.string().uuid(),
    word: NonBlankTextSchema,
    pos: NonBlankTextSchema,
    ipa: NonBlankTextSchema,
    meaning: NonBlankTextSchema,
  })
  .strict();

export type AnalysisVocabularyItem = z.infer<
  typeof AnalysisVocabularyItemSchema
>;

export const AnalysisGrammarItemSchema = z
  .object({
    id: z.string().uuid(),
    name: NonBlankTextSchema,
    description: NonBlankTextSchema,
    formula: NonBlankTextSchema,
    analysis: NonBlankTextSchema,
  })
  .strict();

export type AnalysisGrammarItem = z.infer<typeof AnalysisGrammarItemSchema>;

export const LessonAnalysisSchema = z
  .object({
    sentence_id: z.string().uuid(),
    vocabulary: z.array(AnalysisVocabularyItemSchema),
    grammar: z.array(AnalysisGrammarItemSchema),
    created_at: z.string(),
  })
  .strict();

export type LessonAnalysis = z.infer<typeof LessonAnalysisSchema>;

export const LessonCatalogItemSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string(),
    origin: LessonOriginSchema,
    source_type: LessonSourceTypeSchema,
    content_revision: z.number().int().min(1),
    sentence_count: z.number().int().min(0),
    youtube_video_id: z.string().min(1).nullable(),
    unit: LessonUnitSchema.nullable(),
    updated_at: z.string(),
  })
  .strict();

export type LessonCatalogItem = z.infer<typeof LessonCatalogItemSchema>;

export const LessonCatalogResponseSchema = z
  .object({
    contract_version: LessonContractVersionSchema,
    lessons: z.array(LessonCatalogItemSchema),
    next_cursor: z.string().nullable(),
  })
  .strict();

export type LessonCatalogResponse = z.infer<typeof LessonCatalogResponseSchema>;

export const LessonSnapshotSchema = z
  .object({
    id: z.string().uuid(),
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    origin: LessonOriginSchema,
    source_type: LessonSourceTypeSchema,
    content_revision: z.number().int().min(1),
    unit: LessonUnitSchema.nullable(),
    youtube: LessonYoutubeSchema.nullable(),
    sentences: z.array(LessonSentenceSchema),
    blocks: z.array(LessonBlockSchema),
    analyses: z.record(z.string(), LessonAnalysisSchema),
  })
  .strict();

export type LessonSnapshot = z.infer<typeof LessonSnapshotSchema>;

export const LessonSnapshotResponseSchema = z
  .object({
    contract_version: LessonContractVersionSchema,
    lesson: LessonSnapshotSchema,
  })
  .strict();

export type LessonSnapshotResponse = z.infer<
  typeof LessonSnapshotResponseSchema
>;

export const LessonAnalysisResponseSchema = z
  .object({
    contract_version: LessonContractVersionSchema,
    analysis: LessonAnalysisSchema,
  })
  .strict();

export type LessonAnalysisResponse = z.infer<
  typeof LessonAnalysisResponseSchema
>;

export const LessonRevisionStateSchema = z.enum(['current', 'gone']);

export type LessonRevisionState = z.infer<typeof LessonRevisionStateSchema>;

export const LessonRevisionItemSchema = z
  .object({
    id: z.string().uuid(),
    state: LessonRevisionStateSchema,
    content_revision: z.number().int().min(1).nullable(),
  })
  .strict();

export type LessonRevisionItem = z.infer<typeof LessonRevisionItemSchema>;

export const LessonRevisionsRequestSchema = z
  .object({
    lesson_ids: z.array(z.string().uuid()).min(1).max(100),
  })
  .strict();

export type LessonRevisionsRequest = z.infer<
  typeof LessonRevisionsRequestSchema
>;

export const LessonRevisionsResponseSchema = z
  .object({
    contract_version: LessonContractVersionSchema,
    revisions: z.array(LessonRevisionItemSchema),
  })
  .strict();

export type LessonRevisionsResponse = z.infer<
  typeof LessonRevisionsResponseSchema
>;

export const LessonCreationStatusValues = [
  'queued',
  'processing',
  'waiting_transcript',
  'succeeded',
  'failed',
] as const;

export const LessonCreationStatusSchema = z.enum(LessonCreationStatusValues);

export type LessonCreationStatus = z.infer<typeof LessonCreationStatusSchema>;

export const LearnerCreationSourceSchema = z.enum(['text', 'ocr', 'youtube']);

export type LearnerCreationSource = z.infer<typeof LearnerCreationSourceSchema>;

export const LearnerLessonCreationRequestBodySchema = z.union([
  z
    .object({
      source: z.literal('text'),
      text: z.string().trim().min(1),
    })
    .strict(),
  z
    .object({
      source: z.literal('ocr'),
      text: z.string().trim().min(1),
    })
    .strict(),
  z
    .object({
      source: z.literal('youtube'),
      url: z.string().trim().url(),
    })
    .strict(),
]);

export type LearnerLessonCreationRequestBody = z.infer<
  typeof LearnerLessonCreationRequestBodySchema
>;

export const LessonCreationAcceptedResponseSchema = z
  .object({
    contract_version: LessonContractVersionSchema,
    request: z
      .object({
        id: z.string().uuid(),
        status: LessonCreationStatusSchema,
      })
      .strict(),
  })
  .strict();

export type LessonCreationAcceptedResponse = z.infer<
  typeof LessonCreationAcceptedResponseSchema
>;

export const LessonCreationErrorSchema = z
  .object({
    code: z.string().min(1),
    retryable: z.boolean(),
  })
  .strict();

export type LessonCreationError = z.infer<typeof LessonCreationErrorSchema>;

export const LessonCreationStatusResponseSchema = z
  .object({
    contract_version: LessonContractVersionSchema,
    status: LessonCreationStatusSchema,
    lesson_id: z.string().uuid().nullable(),
    error: LessonCreationErrorSchema.nullable(),
  })
  .strict();

export type LessonCreationStatusResponse = z.infer<
  typeof LessonCreationStatusResponseSchema
>;

/**
 * Parse helpers. Every helper rejects a `contract_version` mismatch so the
 * caller can render the "update the app" state instead of a half-parsed
 * lesson (AD-009).
 */
export function parseLessonCatalogResponse(body: unknown):
  | {
      ok: true;
      response: LessonCatalogResponse;
    }
  | {ok: false; message: string} {
  const parsed = LessonCatalogResponseSchema.safeParse(body);
  if (!parsed.success) {
    return {ok: false, message: 'Lesson catalog response failed validation.'};
  }
  return {ok: true, response: parsed.data};
}

export function parseLessonSnapshotResponse(body: unknown):
  | {
      ok: true;
      response: LessonSnapshotResponse;
    }
  | {ok: false; message: string} {
  const parsed = LessonSnapshotResponseSchema.safeParse(body);
  if (!parsed.success) {
    return {ok: false, message: 'Lesson snapshot response failed validation.'};
  }
  return {ok: true, response: parsed.data};
}

export function parseLessonAnalysisResponse(body: unknown):
  | {
      ok: true;
      response: LessonAnalysisResponse;
    }
  | {ok: false; message: string} {
  const parsed = LessonAnalysisResponseSchema.safeParse(body);
  if (!parsed.success) {
    return {ok: false, message: 'Lesson analysis response failed validation.'};
  }
  return {ok: true, response: parsed.data};
}

export function parseLessonRevisionsResponse(body: unknown):
  | {
      ok: true;
      response: LessonRevisionsResponse;
    }
  | {ok: false; message: string} {
  const parsed = LessonRevisionsResponseSchema.safeParse(body);
  if (!parsed.success) {
    return {ok: false, message: 'Lesson revisions response failed validation.'};
  }
  return {ok: true, response: parsed.data};
}

export function parseLessonCreationAcceptedResponse(body: unknown):
  | {
      ok: true;
      response: LessonCreationAcceptedResponse;
    }
  | {ok: false; message: string} {
  const parsed = LessonCreationAcceptedResponseSchema.safeParse(body);
  if (!parsed.success) {
    return {ok: false, message: 'Lesson creation response failed validation.'};
  }
  return {ok: true, response: parsed.data};
}

export function parseLessonCreationStatusResponse(body: unknown):
  | {
      ok: true;
      response: LessonCreationStatusResponse;
    }
  | {ok: false; message: string} {
  const parsed = LessonCreationStatusResponseSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Lesson creation status response failed validation.',
    };
  }
  return {ok: true, response: parsed.data};
}
