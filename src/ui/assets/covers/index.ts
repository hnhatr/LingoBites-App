import type {ImageSourcePropType} from 'react-native';

/**
 * Pictures shown when an item has no image of its own (or it cannot load):
 * one per kind of item, `default` for anything else.
 */
export type DefaultCoverKind = 'course' | 'lesson' | 'vocab' | 'default';

export const DEFAULT_COVERS: Record<DefaultCoverKind, ImageSourcePropType> = {
  course: require('./course_default.webp'),
  lesson: require('./lesson_default.webp'),
  vocab: require('./vocab_default.webp'),
  default: require('./default.webp'),
};
