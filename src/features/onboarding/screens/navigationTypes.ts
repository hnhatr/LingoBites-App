/** Phase 2 (P2.4): where the placement test was opened from. */
export type PlacementMode = 'onboarding' | 'settings';

export type LearnerOnboardingRouteParams = undefined;
export type PlacementTestRouteParams = {mode: PlacementMode};
export type PlacementResultRouteParams = {
  mode: PlacementMode;
  suggestedLevel: 'A1' | 'A2';
  total: number;
  max: number;
};
export type LearningProfileRouteParams = undefined;

/** Screens of the onboarding gate and the profile settings page. */
export type OnboardingParamList = {
  LearnerOnboarding: LearnerOnboardingRouteParams;
  PlacementTest: PlacementTestRouteParams;
  PlacementResult: PlacementResultRouteParams;
  LearningProfile: LearningProfileRouteParams;
};
