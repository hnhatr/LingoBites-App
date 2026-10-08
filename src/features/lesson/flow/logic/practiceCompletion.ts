import type {LessonBlock, LessonSnapshot} from '@core/schemas/lesson';
import type {LessonActivityAttemptRow} from '@core/sync/activityAttempts';

/**
 * PR 8 rule G5, the same as the Server's `recordLessonAttempts`: the practice
 * part of a curriculum lesson is done once every `activity` block of steps
 * 2–4 has an attempt whose outcome is not `unscorable`. Step 5 (independent
 * use) is not part of it. A lesson without such blocks is never "done".
 */
export const PRACTICE_STEPS: readonly number[] = [2, 3, 4];

/** Steps the player walks through; 6 is the result screen. */
export const FLOW_STEPS = [1, 2, 3, 4, 5, 6] as const;
export type FlowStep = (typeof FLOW_STEPS)[number];

type AttemptLike = Pick<LessonActivityAttemptRow, 'blockId' | 'outcome'>;

/**
 * A curriculum lesson the six-step player can run: authored by the admin,
 * with a specification and at least one block placed on a step.
 */
export function isFlowLesson(snapshot: LessonSnapshot): boolean {
  return (
    snapshot.origin === 'admin' &&
    snapshot.spec != null &&
    snapshot.blocks.some(block => block.step != null)
  );
}

/** The blocks of one step in learner order. */
export function blocksOfStep(
  snapshot: LessonSnapshot,
  step: number,
): LessonBlock[] {
  return snapshot.blocks
    .filter(block => block.step === step)
    .sort((a, b) => a.position - b.position);
}

function activityBlocks(snapshot: LessonSnapshot, steps: readonly number[]) {
  return snapshot.blocks.filter(
    block =>
      block.type === 'activity' &&
      block.step != null &&
      steps.includes(block.step),
  );
}

/** Block ids that have at least one scorable attempt. */
export function attemptedBlockIds(
  attempts: readonly AttemptLike[],
): Set<string> {
  return new Set(
    attempts
      .filter(attempt => attempt.outcome !== 'unscorable')
      .map(attempt => attempt.blockId),
  );
}

export function practiceCompleted(
  snapshot: LessonSnapshot,
  attempts: readonly AttemptLike[],
): boolean {
  const blocks = activityBlocks(snapshot, PRACTICE_STEPS);
  if (blocks.length === 0) return false;
  const done = attemptedBlockIds(attempts);
  return blocks.every(block => done.has(block.id));
}

/** Activity blocks of steps 2–4 still without a scorable attempt. */
export function remainingPracticeCount(
  snapshot: LessonSnapshot,
  attempts: readonly AttemptLike[],
): number {
  const done = attemptedBlockIds(attempts);
  return activityBlocks(snapshot, PRACTICE_STEPS).filter(
    block => !done.has(block.id),
  ).length;
}

/**
 * Where "continue" opens (decision G2): the first step 2–5 that still has an
 * activity without an attempt; step 1 before anything was done; step 6 once
 * every activity has one.
 */
export function resumeStep(
  snapshot: LessonSnapshot,
  attempts: readonly AttemptLike[],
): FlowStep {
  const done = attemptedBlockIds(attempts);
  if (done.size === 0) return 1;
  for (const step of [2, 3, 4, 5] as const) {
    if (activityBlocks(snapshot, [step]).some(block => !done.has(block.id))) {
      return step;
    }
  }
  return 6;
}
