import type {ComponentType} from 'react';

import {ActivityBlockView} from '../components/ActivityBlockView';
import {ContextBlockView} from '../components/ContextBlockView';
import {ExampleBlockView} from '../components/ExampleBlockView';
import {ExerciseBlockView} from '../components/ExerciseBlockView';
import {GrammarBlockView} from '../components/GrammarBlockView';
import {MediaBlockView} from '../components/MediaBlockView';
import {TextBlockView} from '../components/TextBlockView';
import {UnsupportedBlockView} from '../components/UnsupportedBlockView';
import {VocabularyBlockView} from '../components/VocabularyBlockView';

/**
 * `block.type → renderer` registry for curriculum lesson blocks.
 *
 * Dispatch is solely on the parsed `block.type` — never on lesson ID or any
 * other lesson-level field (AD-005). Unknown types cannot occur in the
 * parsed model (`parseCurriculumLessonBlock` degrades them to
 * `unsupported`), but {@link resolveCurriculumLessonBlockRenderer} still
 * falls back defensively so a renderer lookup can never return undefined.
 */

export const CURRICULUM_LESSON_BLOCK_RENDERERS = {
  text: TextBlockView,
  example: ExampleBlockView,
  vocabulary: VocabularyBlockView,
  media: MediaBlockView,
  context: ContextBlockView,
  grammar: GrammarBlockView,
  activity: ActivityBlockView,
  exercise: ExerciseBlockView,
  unsupported: UnsupportedBlockView,
} as const satisfies Record<string, ComponentType<any>>;

export type CurriculumLessonBlockType =
  keyof typeof CURRICULUM_LESSON_BLOCK_RENDERERS;

export function resolveCurriculumLessonBlockRenderer(
  type: string,
): ComponentType<any> {
  const renderer = (
    CURRICULUM_LESSON_BLOCK_RENDERERS as Record<string, ComponentType<any>>
  )[type];
  return renderer ?? UnsupportedBlockView;
}
