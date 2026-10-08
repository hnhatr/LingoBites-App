import type {
  LessonBlock,
  LessonSituation,
  LessonSnapshot,
  LessonTask,
} from '@core/schemas/lesson';
import type {LessonAttemptOutcome} from '@core/schemas/sync';

/**
 * PR 11 step 5: an activity block on step 5 that runs the lesson's
 * independent task is played as "independent use" (decision G4): the task's
 * situation, no model and no hints, judged against the task's criteria.
 */
export function isIndependentBlock(
  block: LessonBlock,
  task: LessonTask | null,
): boolean {
  return block.step === 5 && task?.kind === 'independent';
}

export type Criterion = LessonTask['criteria'][number]['criterion'];

/**
 * Self-assessment against the criteria (decision G5): every required
 * criterion ticked passes independently; a task without required criteria
 * passes once any is ticked.
 */
export function criteriaOutcome(
  criteria: LessonTask['criteria'],
  ticked: ReadonlySet<Criterion>,
): LessonAttemptOutcome {
  const required = criteria.filter(entry => entry.required);
  const passed =
    required.length > 0
      ? required.every(entry => ticked.has(entry.criterion))
      : ticked.size > 0;
  return passed ? 'pass_independent' : 'fail';
}

/** The task's own situation, else the lesson's. */
export function situationOf(
  task: LessonTask,
  snapshot: LessonSnapshot,
): LessonSituation | null {
  return task.situation ?? snapshot.spec?.situation ?? null;
}
