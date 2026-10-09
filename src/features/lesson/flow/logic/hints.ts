import {z} from 'zod';

import type {LessonTask} from '@core/schemas/lesson';
import type {LessonSupportLevel} from '@core/schemas/sync';

/**
 * PR 11 hints. A task's own `hint_levels` (Server `HintLevelsSchema`) open
 * one at a time; without them the player uses three fixed levels, the same
 * ones as the admin preview: the first word (and the model read aloud), the
 * pattern frame or half the sentence, then the whole model sentence.
 */

const HintLevelsSchema = z
  .array(
    z
      .object({
        level: z.number().int().min(1).max(3),
        type: z.enum(['replay', 'keyword', 'model']),
        content_vi: z.string().trim().min(1),
        content_en: z.string().trim().min(1).optional(),
      })
      .strict(),
  )
  .max(3)
  .refine(levels => levels.every((hint, index) => hint.level === index + 1));

export type HintStep = {
  level: number;
  type: 'replay' | 'keyword' | 'pattern' | 'model' | 'eliminate';
  text: string;
  /** Read aloud when this level opens (the model sentence). */
  speak: string | null;
};

/** A task's hint levels; `[]` when it has none or they are malformed (G8). */
export function parseHintLevels(task: LessonTask | null): HintStep[] {
  if (!task) return [];
  const parsed = HintLevelsSchema.safeParse(task.hint_levels);
  if (!parsed.success) return [];
  return parsed.data.map(hint => ({
    level: hint.level,
    type: hint.type,
    text: hint.content_vi,
    speak: null,
  }));
}

/**
 * The hint ladder of one entry (decision G1). `model` is the sentence the
 * entry expects; `frame` the pattern frame when the entry has one.
 */
export function hintLadder({
  task,
  model,
  frame,
}: {
  task: LessonTask | null;
  model: string;
  frame?: string | null;
}): HintStep[] {
  // Independent use (step 5) has no hints at all (PR 11 G4, PR 14 H11).
  if (task?.kind === 'independent') return [];
  const own = parseHintLevels(task);
  if (own.length > 0) {
    return own.map(step =>
      step.type === 'replay' ? {...step, speak: model} : step,
    );
  }
  const words = model.trim().split(/\s+/).filter(Boolean);
  const half = words.slice(0, Math.max(1, Math.ceil(words.length / 2)));
  return [
    {level: 1, type: 'keyword', text: `${words[0] ?? ''} …`, speak: model},
    frame
      ? {level: 2, type: 'pattern', text: frame, speak: null}
      : {level: 2, type: 'keyword', text: `${half.join(' ')} …`, speak: null},
    {level: 3, type: 'model', text: model, speak: null},
  ];
}

/**
 * The support level the opened hints amount to (decision G2): a `model`
 * hint or level 3 → `model`, level 2 → `hint_2`, level 1 → `hint_1`.
 */
export function supportLevelOf(
  opened: readonly HintStep[],
): LessonSupportLevel {
  if (opened.length === 0) return 'none';
  if (opened.some(step => step.type === 'model' || step.level >= 3)) {
    return 'model';
  }
  return opened.some(step => step.level >= 2) ? 'hint_2' : 'hint_1';
}
