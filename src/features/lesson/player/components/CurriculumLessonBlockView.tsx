import React from 'react';
import {View} from 'react-native';

import {
  CURRICULUM_LESSON_BLOCK_RENDERERS,
  resolveCurriculumLessonBlockRenderer,
} from '../logic/blockRegistry';
import type {CurriculumLessonSoundFactory} from '../logic/curriculumLessonAudio';
import type {CurriculumLessonParsedBlock} from '../logic/curriculumLessonSchema';
import type {CurriculumLessonCheckFn} from './ExerciseBlockView';

export type CurriculumLessonBlockViewProps = {
  block: CurriculumLessonParsedBlock;
  onCheckExercise: CurriculumLessonCheckFn;
  createSound?: CurriculumLessonSoundFactory;
};

/**
 * Dispatches one parsed block to its renderer by `block.type` only.
 *
 * The registry lookup selects the component (and guarantees a fallback),
 * while this switch narrows the block so each renderer receives exactly the
 * props its schema variant carries.
 */
export function CurriculumLessonBlockView({
  block,
  onCheckExercise,
  createSound,
}: CurriculumLessonBlockViewProps) {
  switch (block.type) {
    case 'text':
      return <CURRICULUM_LESSON_BLOCK_RENDERERS.text data={block.data} />;
    case 'example':
      return <CURRICULUM_LESSON_BLOCK_RENDERERS.example data={block.data} />;
    case 'vocabulary':
      return (
        <CURRICULUM_LESSON_BLOCK_RENDERERS.vocabulary items={block.items} />
      );
    case 'media':
      return (
        <CURRICULUM_LESSON_BLOCK_RENDERERS.media
          media={block.media}
          createSound={createSound}
        />
      );
    case 'context':
      return <CURRICULUM_LESSON_BLOCK_RENDERERS.context data={block.data} />;
    case 'grammar':
      return <CURRICULUM_LESSON_BLOCK_RENDERERS.grammar data={block.data} />;
    case 'activity':
      return <CURRICULUM_LESSON_BLOCK_RENDERERS.activity data={block.data} />;
    case 'exercise':
      return (
        <CURRICULUM_LESSON_BLOCK_RENDERERS.exercise
          exercise={block.exercise}
          onCheckExercise={onCheckExercise}
        />
      );
    case 'unsupported':
      return <CURRICULUM_LESSON_BLOCK_RENDERERS.unsupported block={block} />;
  }
  // Unreachable in the parsed model (every `type` is cased above);
  // defensive for untyped callers so dispatch never returns undefined.
  const Fallback = resolveCurriculumLessonBlockRenderer('unsupported');
  return (
    <Fallback
      block={{type: 'unsupported', blockId: null, position: null, raw: block}}
    />
  );
}

/** Renders the current player block inside a stable container. */
export function CurriculumLessonBlockSlot(
  props: CurriculumLessonBlockViewProps,
) {
  return (
    <View testID="lesson-player-block">
      <CurriculumLessonBlockView {...props} />
    </View>
  );
}
