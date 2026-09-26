import {z} from 'zod';

export const PRACTICE_CONTRACT_VERSION = 1;
export const PRACTICE_GENERATOR_VERSION = 'generator-v1';
export const PRACTICE_VALIDATOR_VERSION = 'validator-v1';
export const PRACTICE_GRADER_VERSION = 'grader-v1';
export const PRACTICE_CALCULATOR_VERSION = 'calculator-v1';
export const PRACTICE_SNAPSHOT_SCHEMA_VERSION = 'snapshot-v1';

export const PracticeQuestionOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
});

export const PracticeSourceRefSchema = z.object({
  kind: z.enum(['sentence', 'vocabulary', 'grammar']),
  id: z.string(),
});

export const PracticeSourceSnapshotSchema = z.object({
  snapshot_schema_version: z.string(),
  source_text: z.string().optional(),
  surface_form: z.string().optional(),
  canonical_meaning: z.string().optional(),
  translation: z.string().optional(),
});

export const PracticeProvenanceSchema = z.object({
  generation_attempt: z.number(),
  prompt_version: z.string(),
  model: z.string().optional(),
});

export const PracticeValidationSchema = z.object({
  validator_version: z.string(),
  checks: z.array(z.string()),
  passed: z.boolean(),
});

export const PracticeQuestionBaseSchema = z.object({
  id: z.string(),
  skill: z.string(),
  difficulty: z.string(),
  prompt_vi: z.string(),
  explanation_vi: z.string(),
  source_refs: z.array(PracticeSourceRefSchema),
  source_snapshot: PracticeSourceSnapshotSchema,
  provenance: PracticeProvenanceSchema,
  validation: PracticeValidationSchema,
});

export const MeaningChoiceSchema = PracticeQuestionBaseSchema.extend({
  variant: z.literal('meaning_choice'),
  vocabulary_id: z.string(),
  options: z.array(PracticeQuestionOptionSchema),
  correct_option_id: z.string(),
}).refine(data => data.options.some(opt => opt.id === data.correct_option_id), {
  message: 'correct_option_id must exist in options',
  path: ['correct_option_id'],
});

export const ClozeChoiceSchema = PracticeQuestionBaseSchema.extend({
  variant: z.literal('cloze_choice'),
  sentence_id: z.string(),
  stem_with_placeholder: z.string(),
  blank: z.object({
    char_start: z.number(),
    char_end: z.number(),
    source_text: z.string(),
  }),
  options: z.array(PracticeQuestionOptionSchema),
  correct_option_id: z.string(),
}).refine(data => data.options.some(opt => opt.id === data.correct_option_id), {
  message: 'correct_option_id must exist in options',
  path: ['correct_option_id'],
});

export const PracticeQuestionSchema = z.union([
  MeaningChoiceSchema,
  ClozeChoiceSchema,
]);

export const PracticeGeneratorSchema = z.object({
  provider: z.string(),
  model: z.string(),
  prompt_version: z.string(),
  generator_version: z.string(),
});

export const PracticeSetSchema = z.object({
  id: z.string(),
  contract_version: z.number(),
  status: z.enum(['generating', 'ready', 'generation_failed', 'invalidated']),
  lesson_id: z.string(),
  lesson_revision: z.number(),
  source_fingerprint: z.string(),
  config_hash: z.string(),
  seed: z.string().optional(),
  difficulty: z.string(),
  requested_count: z.number(),
  set_revision: z.number(),
  generator: PracticeGeneratorSchema,
  questions: z.array(PracticeQuestionSchema),
  validation_summary: z.record(z.unknown()).optional(),
  created_at: z.string(),
  ready_at: z.string().optional(),
  error: z.record(z.unknown()).optional(),
});

export const PracticeSessionSchema = z.object({
  id: z.string(),
  practice_set_id: z.string(),
  set_revision: z.number(),
  lesson_id: z.string(),
  lesson_revision: z.number(),
  status: z.enum(['in_progress', 'completed', 'abandoned']),
  question_order: z
    .array(z.string())
    .refine(arr => new Set(arr).size === arr.length, {
      message: 'question_order must contain unique IDs',
    }),
  current_index: z.number(),
  attempt_no: z.number(),
  started_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().optional(),
  device_id: z.string().optional(),
});

export const AnswerEventSchema = z.object({
  event_id: z.string(),
  contract_version: z.number(),
  session_id: z.string(),
  question_id: z.string(),
  sequence: z.number(),
  selected_option_id: z.string(),
  is_correct: z.boolean(),
  answered_at: z.string(),
  duration_ms: z.number(),
  try_index: z.number(),
  grading: z.object({
    mode: z.enum(['device_deterministic']),
    grader_version: z.string(),
  }),
  sync_status: z.string().optional(),
});

export const ResultSummarySchema = z.object({
  id: z.string(),
  session_id: z.string(),
  total_questions: z.number(),
  answered: z.number(),
  correct: z.number(),
  score_percent: z.number(),
  breakdown: z.object({
    vocabulary: z.number().optional(),
    translation: z.number().optional(),
    sentence: z.number().optional(),
  }),
  review_candidates: z.array(
    z.object({
      source_kind: z.enum(['sentence', 'vocabulary', 'grammar']),
      source_id: z.string(),
      wrong_count: z.number(),
    }),
  ),
  calculated_at: z.string(),
  calculator_version: z.string(),
});

export const PracticeEventBatchSchema = z.object({
  contract_version: z.number(),
  events: z
    .array(
      z.object({
        event_id: z.string(),
        event_type: z.literal('practice_answered'),
        session_id: z.string(),
        sequence: z.number(),
        occurred_at: z.string(),
        payload: AnswerEventSchema,
      }),
    )
    .refine(
      events => {
        const keys = new Set(events.map(e => `${e.session_id}:${e.sequence}`));
        return keys.size === events.length;
      },
      {message: 'events must be unique by session_id and sequence'},
    ),
});

export type PracticeQuestionOption = z.infer<
  typeof PracticeQuestionOptionSchema
>;
export type PracticeSourceRef = z.infer<typeof PracticeSourceRefSchema>;
export type PracticeSourceSnapshot = z.infer<
  typeof PracticeSourceSnapshotSchema
>;
export type PracticeProvenance = z.infer<typeof PracticeProvenanceSchema>;
export type PracticeValidation = z.infer<typeof PracticeValidationSchema>;
export type MeaningChoice = z.infer<typeof MeaningChoiceSchema>;
export type ClozeChoice = z.infer<typeof ClozeChoiceSchema>;
export type PracticeQuestion = z.infer<typeof PracticeQuestionSchema>;
export type PracticeGenerator = z.infer<typeof PracticeGeneratorSchema>;
export type PracticeSet = z.infer<typeof PracticeSetSchema>;
export type PracticeSession = z.infer<typeof PracticeSessionSchema>;
export type AnswerEvent = z.infer<typeof AnswerEventSchema>;
export type ResultSummary = z.infer<typeof ResultSummarySchema>;
export type PracticeEventBatch = z.infer<typeof PracticeEventBatchSchema>;
