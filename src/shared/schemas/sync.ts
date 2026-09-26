import { z } from 'zod';

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
 * - Converging order is last-writer-wins by (`occurred_at`, `mutation_id`).
 * - A `tombstone` record is a deletion marker: pullers must delete the entity
 *   locally. Tombstones participate in last-writer-wins like any write, so a
 *   stale write can never resurrect a deleted entity.
 */

export const SYNC_CONTRACT_VERSION = 1;

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
 */
export const SyncCollectionSchema = z.enum([
  'flashcards',
  'review_schedules',
  'review_sessions',
  'gamification_events',
  'content_review_items',
  'content_review_state',
  'content_lesson_state',
  'grammar_bookmarks',
  'youtube_lessons',
  'youtube_sentences',
  'youtube_progress',
  'learner_profile',
  'first_listen_attempts',
  'passed_situations',
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

export const SyncPullSuccessResponseSchema = z.object({
  request_id: z.string().uuid(),
  status: z.literal('success'),
  contract_version: z.literal(SYNC_CONTRACT_VERSION),
  records: z.array(SyncRecordSchema),
  next_cursor: z.string(),
  has_more: z.boolean(),
});

export type SyncPullSuccessResponse = z.infer<
  typeof SyncPullSuccessResponseSchema
>;
