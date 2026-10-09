import {z} from 'zod';

import {parseItemCode} from '../learning/itemCode';
import {ActivityKindValues} from './activityContent';
import {LessonSourceTypeSchema} from './lesson';

/**
 * Learner-state sync contract (SETE-292 T4 / SETE-294).
 *
 * Versioned source of truth for local-only learner state. Mobile (T8) and the
 * account-merge task (T9) must import these schemas instead of redefining the
 * push/pull contract. Bump SYNC_CONTRACT_VERSION when breaking the shape.
 *
 * - `POST /v1/sync/push` applies an atomic batch of mutations. Every mutation
 *   carries a client-generated `mutation_id`: replays with identical content
 *   are absorbed (`duplicate`), older mutations lose to stored state
 *   (`stale`), and reusing a `mutation_id` with different content rejects the
 *   whole batch with 409 MUTATION_CONFLICT.
 * - `GET /v1/sync/pull` pages the user's records in `revision` order behind
 *   an opaque, user-bound cursor. Cursors never cross accounts.
 * - Converging order is last-writer-wins by (`occurred_at`, `mutation_id`),
 *   except for `lesson_progress`, which merges by rank
 *   (`in_progress` < `completed`) instead (AD-002, INV-001).
 * - A `tombstone` record is a deletion marker: pullers must delete the entity
 *   locally. Tombstones participate in last-writer-wins like any write, so a
 *   stale write can never resurrect a deleted entity. `lesson_progress` rows
 *   are never tombstoned: every mutation must carry the v2 `{event}` payload
 *   and a tombstoned batch is rejected 400 `VALIDATION_SYNC` (DEV-002).
 */

export const SYNC_CONTRACT_VERSION = 2;

/** Transport and batch bounds for the sync contract. */
export const SYNC_MAX_BATCH_SIZE = 100;
/**
 * Per-mutation payload cap. Deliberately below the framework body limit
 * (~64 KiB) so oversized payloads get the contract's 400 SYNC_PAYLOAD_TOO_LARGE
 * instead of a bare 413 from the transport.
 */
export const SYNC_MAX_PAYLOAD_BYTES = 32 * 1024;
export const SYNC_PULL_DEFAULT_LIMIT = 100;
export const SYNC_PULL_MAX_LIMIT = 500;
/** Client clock skew tolerated for `occurred_at` (milliseconds). */
export const SYNC_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

/**
 * Explicit collection allowlist. `sync_outbox` itself is excluded on purpose
 * (it is a transport drain, not syncable state), as are binary recordings.
 *
 * LING-149 replaced the six retired lesson-area collections
 * (`content_review_items`, `content_review_state`, `content_lesson_state`,
 * `youtube_lessons`, `youtube_sentences`, `youtube_progress`) with the single
 * `lesson_progress` collection (AD-002, AD-008).
 * `content_review_items` and related types were retired in LING-249.
 */
export const SyncCollectionSchema = z.enum([
  'flashcards',
  'review_schedules',
  'review_sessions',
  'gamification_events',
  'lesson_progress',
  'grammar_bookmarks',
  'learner_profile',
  'first_listen_attempts',
  'passed_situations',
  'speaking_attempts',
  'activity_attempts',
  'lesson_bookmarks',
]);

export type SyncCollection = z.infer<typeof SyncCollectionSchema>;

export const SyncEntityIdSchema = z.string().min(1).max(128);

export const SyncPayloadSchema = z.record(z.string(), z.unknown());

export const SyncOccurredAtSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(value => !Number.isNaN(Date.parse(value)), {
    message: 'occurred_at must be a parseable date-time string',
  });

export const SyncPushMutationSchema = z.object({
  /** Client-generated idempotency key, unique per user. */
  mutation_id: z.string().uuid(),
  collection: SyncCollectionSchema,
  entity_id: SyncEntityIdSchema,
  /** Arbitrary JSON object; tombstones conventionally send `{}`. */
  payload: SyncPayloadSchema,
  /** Deletion marker; pullers must delete the entity locally. */
  tombstone: z.boolean().optional().default(false),
  /** Client-observed write time; drives last-writer-wins convergence. */
  occurred_at: SyncOccurredAtSchema,
});

export type SyncPushMutation = z.infer<typeof SyncPushMutationSchema>;

export const SyncPushRequestSchema = z.object({
  mutations: z.array(SyncPushMutationSchema).min(1).max(SYNC_MAX_BATCH_SIZE),
});

export type SyncPushRequest = z.infer<typeof SyncPushRequestSchema>;

export const SyncPushItemStatusSchema = z.enum([
  'applied',
  'duplicate',
  'stale',
]);

export type SyncPushItemStatus = z.infer<typeof SyncPushItemStatusSchema>;

export const SyncPushItemResultSchema = z.object({
  mutation_id: z.string().uuid(),
  collection: SyncCollectionSchema,
  entity_id: SyncEntityIdSchema,
  status: SyncPushItemStatusSchema,
  /** Server revision of the winning write (or the stored row for stale). */
  revision: z.number().int().positive(),
});

export type SyncPushItemResult = z.infer<typeof SyncPushItemResultSchema>;

export const SyncPushSuccessResponseSchema = z.object({
  request_id: z.string().uuid(),
  status: z.literal('success'),
  contract_version: z.literal(SYNC_CONTRACT_VERSION),
  results: z.array(SyncPushItemResultSchema),
});

export type SyncPushSuccessResponse = z.infer<
  typeof SyncPushSuccessResponseSchema
>;

export const SyncRecordSchema = z.object({
  collection: SyncCollectionSchema,
  entity_id: SyncEntityIdSchema,
  payload: SyncPayloadSchema,
  revision: z.number().int().positive(),
  occurred_at: z.string(),
  updated_at: z.string(),
  tombstone: z.boolean(),
});

export type SyncRecord = z.infer<typeof SyncRecordSchema>;

/**
 * Pull-side record: identical to {@link SyncRecordSchema} except `collection`
 * stays an open string. Pull is liberal in what it accepts — records of
 * collections this build does not know still parse, and the pull applier
 * skips them with a log line instead of stalling paging (AD-008). Push keeps
 * the strict allowlist: this client never sends an unknown collection.
 */
export const SyncPullRecordSchema = SyncRecordSchema.extend({
  collection: z.string().min(1).max(128),
});

export type SyncPullRecord = z.infer<typeof SyncPullRecordSchema>;

export const SyncPullSuccessResponseSchema = z.object({
  request_id: z.string().uuid(),
  status: z.literal('success'),
  contract_version: z.literal(SYNC_CONTRACT_VERSION),
  records: z.array(SyncPullRecordSchema),
  next_cursor: z.string(),
  has_more: z.boolean(),
});

export type SyncPullSuccessResponse = z.infer<
  typeof SyncPullSuccessResponseSchema
>;

/**
 * `lesson_progress` payloads (LING-149 FR-019/FR-020, AD-002). Mirrors the
 * Server source of truth in `src/modules/sync/model/sync.ts`.
 *
 * Push carries the event the learner performed on the device; the server merges
 * it monotonically and stores the resulting state. Pull therefore returns the
 * merged state, not the event. `entity_id` is the canonical lesson id.
 */
export const LessonProgressEventSchema = z.enum(['start', 'complete']);

export type LessonProgressEvent = z.infer<typeof LessonProgressEventSchema>;

export const LessonProgressPushPayloadSchema = z
  .object({
    event: LessonProgressEventSchema,
  })
  .strict();

export type LessonProgressPushPayload = z.infer<
  typeof LessonProgressPushPayloadSchema
>;

/** Progress only ever moves forward, so a stored state is never `none`. */
export const LessonProgressStatusSchema = z.enum(['in_progress', 'completed']);

export type LessonProgressStatus = z.infer<typeof LessonProgressStatusSchema>;

export const LessonProgressStatePayloadSchema = z
  .object({
    status: LessonProgressStatusSchema,
    started_at: z.string(),
    completed_at: z.string().nullable(),
  })
  .strict();

export type LessonProgressStatePayload = z.infer<
  typeof LessonProgressStatePayloadSchema
>;

/** Speaking modes allowed in sync payloads (LING-224 contract r1). */
export const SpeakingModeSyncSchema = z.enum([
  'shadowing',
  'quick_answer',
  'standup',
  'app_description',
  'bug_report',
  'mock_interview',
]);

export type SpeakingModeSync = z.infer<typeof SpeakingModeSyncSchema>;

/**
 * Push/pull payload for `speaking_attempts` (LING-224 FR-026, INV-006).
 * Metadata only — no audio, paths, or base64.
 */
export const SpeakingAttemptPayloadSchema = z
  .object({
    lesson_id: z.string().uuid(),
    sentence_id: z.string().uuid(),
    mode: SpeakingModeSyncSchema,
    check_full_sentence: z.boolean(),
    check_key_words: z.boolean(),
    check_rhythm: z.boolean(),
    duration_ms: z.number().int().min(1).max(35000),
    recording_id: z.string().uuid().nullable(),
  })
  .strict();

export type SpeakingAttemptPayload = z.infer<
  typeof SpeakingAttemptPayloadSchema
>;

/**
 * `activity_attempts` push payload (mirror of the Server's
 * `ActivityAttemptPushPayloadSchema`): identifiers, outcome and timing only,
 * never lesson or answer text. `entity_id` is the attempt uuid.
 */
export const ActivityAttemptKindValues = [
  'review',
  'practice',
  'game',
] as const;

export const ActivityAttemptResultValues = [
  'correct',
  'incorrect',
  'skipped',
] as const;

export const ActivityAttemptPayloadSchema = z
  .object({
    kind: z.enum(ActivityAttemptKindValues),
    activity: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9_]+$/),
    lesson_id: z.string().uuid().nullable(),
    item_key: z.string().trim().min(1).max(255).nullable(),
    session_id: z.string().uuid().nullable(),
    result: z.enum(ActivityAttemptResultValues),
    score: z.number().min(0).max(1).nullable(),
    duration_ms: z.number().int().min(0).max(3_600_000),
  })
  .strict();

export type ActivityAttemptPayload = z.infer<
  typeof ActivityAttemptPayloadSchema
>;

/**
 * PR 8 (written by the app from PR 10): one answered activity block of a
 * curriculum lesson's player. Still only identifiers, the outcome and timing:
 * never what the learner said or wrote. `assessed_by` is `rule` when the app
 * grades a choice or a typed answer and `self` when the learner judges their
 * own speaking. Mirror of the Server's `LessonActivityAttemptSchema`.
 */
export const LessonSupportLevelValues = [
  'none',
  'hint_1',
  'hint_2',
  'model',
] as const;

/**
 * `pending` / `service` (PR 12, sent by the app from PR 14): the answer went
 * to the Server's scorer; the result arrives in the read-only `evaluations`
 * collection, never in the attempt. `recording_client_id` links a spoken
 * answer's recording.
 */
export const LessonAttemptOutcomeValues = [
  'pass_independent',
  'pass_with_support',
  'fail',
  'unscorable',
  'pending',
] as const;

export const LessonAttemptAssessorValues = ['rule', 'self', 'service'] as const;

export const LESSON_ATTEMPT_ITEM_KEYS_MAX = 20;

export const LessonActivityAttemptPayloadSchema = z
  .object({
    kind: z.literal('lesson'),
    activity: z.enum(ActivityKindValues),
    lesson_id: z.string().uuid(),
    block_id: z.string().uuid(),
    content_revision: z.number().int().min(1),
    step: z.number().int().min(1).max(6),
    task_id: z.string().uuid().nullable(),
    item_keys: z
      .array(
        z
          .string()
          .refine(code => parseItemCode(code) !== null, 'not an item code'),
      )
      .max(LESSON_ATTEMPT_ITEM_KEYS_MAX),
    session_id: z.string().uuid().nullable(),
    support_level: z.enum(LessonSupportLevelValues),
    outcome: z.enum(LessonAttemptOutcomeValues),
    assessed_by: z.enum(LessonAttemptAssessorValues),
    duration_ms: z.number().int().min(0).max(3_600_000),
    recording_client_id: z.string().uuid().optional(),
  })
  .strict()
  .refine(
    attempt =>
      attempt.support_level === 'none' ||
      attempt.outcome !== 'pass_independent',
    {message: 'a supported attempt cannot pass independently'},
  )
  .refine(
    attempt =>
      (attempt.outcome === 'pending') === (attempt.assessed_by === 'service'),
    {message: 'a service-assessed attempt is pending, and only it'},
  )
  .refine(
    attempt =>
      attempt.recording_client_id === undefined ||
      attempt.assessed_by === 'service',
    {message: 'only a service-assessed attempt links a recording'},
  );

export type LessonActivityAttemptPayload = z.infer<
  typeof LessonActivityAttemptPayloadSchema
>;
export type LessonSupportLevel = LessonActivityAttemptPayload['support_level'];
export type LessonAttemptOutcome = LessonActivityAttemptPayload['outcome'];

/** Every `activity_attempts` payload the Server accepts. */
export const ActivityAttemptPushPayloadSchema = z.union([
  ActivityAttemptPayloadSchema,
  LessonActivityAttemptPayloadSchema,
]);

/**
 * `lesson_bookmarks` payloads (Server `LessonBookmarkPushPayloadSchema`): the
 * learner's "save for later" list. `entity_id` is the lesson id; unsaving is a
 * tombstone with `{}`. The payload is just enough to draw the saved lesson's
 * card on a device that has not downloaded it.
 */
export const LessonBookmarkPayloadSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    source_type: LessonSourceTypeSchema,
    sentence_count: z.number().int().min(0).max(100_000),
    estimated_minutes: z.number().int().min(1).max(1_000).nullable(),
    context_label: z.string().trim().min(1).max(255).nullable(),
  })
  .strict();

export type LessonBookmarkPayload = z.infer<typeof LessonBookmarkPayloadSchema>;
