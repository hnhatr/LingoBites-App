/**
 * Release and feature flag contracts.
 * Established in TASK-002 (AD-004 foundation).
 */

export type FeatureReleaseGroup =
  | 'foundation'
  | 'ui'
  | 'practice'
  | 'expansion';

export type FeatureStatus =
  | 'ready'
  | 'beta'
  | 'incomplete'
  | 'not_implemented'
  | 'blocked';

export type FeatureRegistryEntry = {
  key: string;
  module: string;
  required: boolean;
  releaseGroup: FeatureReleaseGroup;
  description?: string;
  status: FeatureStatus;
  entryPoint?: string;
  limitations?: string[];
};

export type ReleaseConfig = {
  releaseName: string;
  description?: string;
  features: Record<string, boolean>;
};

export type ReleaseValidationResult = {
  valid: boolean;
  errors: string[];
};
