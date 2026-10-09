import {z} from 'zod';

import {LessonSupportLevelValues} from './sync';

/**
 * Machine evaluation of a step-5 or summative answer (PR 12–13). Mirror of
 * the Server's `EvaluationPayloadSchema`: the body of
 * `GET /v1/evaluations/:attemptId`, `POST /v1/evaluations/text` and the
 * read-only `evaluations` sync record. It never holds what the learner said
 * or wrote; `missing_words` and `reference_en` come from the lesson.
 */

export const EVALUATIONS_COLLECTION = 'evaluations' as const;

export const EvaluationCriterionValues = [
  'purpose',
  'content',
  'clarity',
  'independence',
] as const;
export type EvaluationCriterion = (typeof EvaluationCriterionValues)[number];

export const EvaluationOutcomeValues = [
  'pass_independent',
  'pass_with_support',
  'fail',
  'unscorable',
] as const;
export type EvaluationOutcome = (typeof EvaluationOutcomeValues)[number];

export const UnscorableReasonValues = [
  'empty',
  'too_short',
  'limit',
  'stt_failed',
] as const;
export type UnscorableReason = (typeof UnscorableReasonValues)[number];

const CriterionResultSchema = z.object({
  passed: z.boolean(),
  score: z.number().nullable(),
  required: z.boolean(),
});

export const EvaluationPayloadSchema = z.object({
  attempt_id: z.string().uuid(),
  lesson_id: z.string().uuid().nullable(),
  unit_id: z.string().uuid().nullable(),
  block_id: z.string().uuid().nullable(),
  task_id: z.string().uuid(),
  source: z.enum(['text', 'speech']),
  substitute: z.boolean(),
  support_level: z.enum(LessonSupportLevelValues),
  outcome: z.enum(EvaluationOutcomeValues),
  criteria: z.object({
    purpose: CriterionResultSchema,
    content: CriterionResultSchema,
    clarity: CriterionResultSchema,
    independence: CriterionResultSchema,
  }),
  errors: z.array(
    z.object({
      item_code: z.string(),
      code: z.string(),
      severity: z.enum(['blocking', 'tolerated']),
      feedback_vi: z.string(),
    }),
  ),
  primary_issue: z
    .union([
      z.object({
        kind: z.literal('criterion'),
        criterion: z.enum(EvaluationCriterionValues),
      }),
      z.object({kind: z.literal('error'), code: z.string()}),
    ])
    .nullable(),
  missing_words: z.array(z.string()),
  reference_en: z.string().nullable(),
  unscorable_reason: z.enum(UnscorableReasonValues).nullable(),
  scorer_version: z.number().int(),
  evaluated_at: z.string(),
});

export type EvaluationPayload = z.infer<typeof EvaluationPayloadSchema>;

/** Where an answer belongs: a lesson's step-5 block or a unit's task. */
export const EvaluationTargetSchema = z.union([
  z.object({lesson_id: z.string().uuid(), block_id: z.string().uuid()}),
  z.object({unit_id: z.string().uuid(), task_id: z.string().uuid()}),
]);
export type EvaluationTarget = z.infer<typeof EvaluationTargetSchema>;

export const EvaluationResponseSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  evaluation: EvaluationPayloadSchema,
});

export const TextEvaluationResponseSchema = EvaluationResponseSchema.extend({
  replayed: z.boolean(),
});

export const EvaluationCapabilitiesResponseSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  evaluation: z.object({text: z.boolean(), speech: z.boolean()}),
});
