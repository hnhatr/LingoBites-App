import type {
  ActivityContentByKind,
  ActivityKind,
} from '@core/schemas/activityContent';
import type {
  LessonBlock,
  LessonSituation,
  LessonSnapshot,
  LessonTask,
} from '@core/schemas/lesson';
import type {LessonAttemptOutcome} from '@core/schemas/sync';

import {comboSentence, type FlowActivity, type FlowItems} from './flowContent';

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

/**
 * The sentences shown under "Xem câu tham khảo" once the learner has judged
 * themselves (decision G5): what the activity's content expects.
 */
export function referenceSentences(
  activity: FlowActivity,
  items: FlowItems,
): string[] {
  const content = activity.content;
  if (!content) return [];
  const as = <K extends ActivityKind>() => content as ActivityContentByKind[K];
  switch (activity.kind) {
    case 'role_play': {
      const play = as<'role_play'>();
      return play.turns
        .filter(turn => turn.speaker === play.learnerSpeaker)
        .map(turn => turn.textEn);
    }
    case 'translation':
      return as<'translation'>().sentences.map(sentence => sentence.modelEn);
    case 'listen_and_repeat':
      return as<'listen_and_repeat'>().prompts.map(prompt => prompt.textEn);
    case 'speaking_drill': {
      const drill = as<'speaking_drill'>();
      return drill.combos.map(combo =>
        comboSentence(items, drill.patternItemId, combo.values),
      );
    }
    case 'fill_blank':
      return as<'fill_blank'>().questions.map(
        q => `${q.beforeEn}${q.answer}${q.afterEn}`,
      );
    case 'multiple_choice':
      return as<'multiple_choice'>().questions.flatMap(q =>
        q.options.filter(o => o.id === q.correctOptionId).map(o => o.text),
      );
  }
}
