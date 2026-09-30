import {type FeatureKey, featureKeys} from '@core/release/feature-registry';
import type {ReleaseConfig} from '@core/release/types';

export type TestReleaseConfigOptions = {
  releaseName?: string;
  description?: string;
};

/**
 * Builds a synthetic release config from registry defaults (all flags off)
 * plus explicit overrides. Does not read shipped preset files.
 */
export function makeTestReleaseConfig(
  overrides: Partial<Record<FeatureKey, boolean>> = {},
  options: TestReleaseConfigOptions = {},
): ReleaseConfig {
  const features = Object.fromEntries(
    featureKeys.map(key => [key, false]),
  ) as Record<string, boolean>;

  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      features[key] = value;
    }
  }

  return {
    releaseName: options.releaseName ?? 'test-release',
    description: options.description ?? 'Synthetic release config for tests',
    features,
  };
}
