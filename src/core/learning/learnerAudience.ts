/**
 * Phase 2 (P2.4, decisions C2 and G5): the signed-in learner's age group, set
 * by onboarding and read by the curriculum screens. Children do not see
 * content marked for adults; everyone else sees everything. Kept here so the
 * course and onboarding features do not import each other.
 */
export type LearnerAgeGroup = 'kids' | 'adults';
export type ContentAudience = 'all' | 'kids' | 'adults';

let ageGroup: LearnerAgeGroup | null = null;

export function setLearnerAgeGroup(value: LearnerAgeGroup | null): void {
  ageGroup = value;
}

export function getLearnerAgeGroup(): LearnerAgeGroup | null {
  return ageGroup;
}

/** Whether content for `audience` is shown to the current learner. */
export function isAudienceVisible(
  audience: ContentAudience,
  learner: LearnerAgeGroup | null = ageGroup,
): boolean {
  return !(learner === 'kids' && audience === 'adults');
}
