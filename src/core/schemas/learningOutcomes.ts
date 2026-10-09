import {z} from 'zod';

/**
 * Read-only outcome collections the Server writes (PR 15) and the app pulls
 * (PR 16). Mirror of the Server's `outcomePayloads.ts`.
 */

export const LESSON_OUTCOMES_COLLECTION = 'lesson_outcomes' as const;
export const UNIT_OUTCOMES_COLLECTION = 'unit_outcomes' as const;
export const ITEM_MEMORY_COLLECTION = 'item_memory' as const;

/** Waits of review stages 0–4 in days (decision T3). */
export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;
export const MAX_REVIEW_STAGE = REVIEW_INTERVAL_DAYS.length - 1;

const timestamp = z.string().datetime();

/** `lesson_outcomes`: entity id is the lesson id. */
export const LessonOutcomePayloadSchema = z.object({
  lesson_id: z.string().uuid(),
  practice_completed_at: timestamp.nullable(),
  passed_at: timestamp.nullable(),
  passed_by: z.enum(['service', 'self', 'rule']).nullable(),
});

/** `unit_outcomes`: entity id is the unit id. */
export const UnitOutcomePayloadSchema = z.object({
  unit_id: z.string().uuid(),
  summative_unlocked_at: timestamp.nullable(),
  passed_at: timestamp.nullable(),
});

/** `item_memory`: entity id is the item code. */
export const ItemMemoryPayloadSchema = z.object({
  item_code: z.string().min(1).max(160),
  stage: z.number().int().min(0).max(MAX_REVIEW_STAGE),
  due_at: timestamp,
  stable_at: timestamp.nullable(),
  last_result: z.enum(['correct', 'incorrect']).nullable(),
  last_reviewed_at: timestamp.nullable(),
});

export type LessonOutcomePayload = z.infer<typeof LessonOutcomePayloadSchema>;
export type UnitOutcomePayload = z.infer<typeof UnitOutcomePayloadSchema>;
export type ItemMemoryPayload = z.infer<typeof ItemMemoryPayloadSchema>;
