import type {StudyActivityType} from './types';

/** The groups the Today screen lists activities under. */
export type ActivityCategory = 'review' | 'lesson' | 'skill';

export const ACTIVITY_CATEGORY_ORDER: readonly ActivityCategory[] = [
  'review',
  'lesson',
  'skill',
];

export const ACTIVITY_CATEGORY_LABELS_VI: Record<ActivityCategory, string> = {
  review: 'Ôn tập',
  lesson: 'Bài học',
  skill: 'Luyện kỹ năng',
};

const CATEGORY_BY_TYPE: Record<StudyActivityType, ActivityCategory> = {
  due_review: 'review',
  error_remediation: 'review',
  active_recall: 'review',
  continue_lesson: 'lesson',
  next_lesson: 'lesson',
  prerequisite_lesson: 'lesson',
  old_situation_practice: 'lesson',
  speaking_practice: 'skill',
  listening_remediation: 'skill',
  interview_practice: 'skill',
};

/** Unknown types (e.g. from an older stored plan) list under lessons. */
export function activityCategory(type: string): ActivityCategory {
  return CATEGORY_BY_TYPE[type as StudyActivityType] ?? 'lesson';
}
