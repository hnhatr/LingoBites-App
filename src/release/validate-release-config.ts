import type {DependencyGroup} from './feature-dependencies';
import type {
  FeatureRegistryEntry,
  ReleaseConfig,
  ReleaseValidationResult,
} from './types';

export function validateReleaseConfig(
  config: ReleaseConfig,
  registry: readonly FeatureRegistryEntry[],
  dependencies: Record<string, DependencyGroup[]>,
): ReleaseValidationResult {
  const errors: string[] = [];
  const enabled = config.features;
  const registryKeySet = new Set(registry.map(entry => entry.key));

  for (const key of Object.keys(enabled)) {
    if (!registryKeySet.has(key)) {
      errors.push(`Unknown feature key "${key}".`);
    }
  }

  for (const [key, isOn] of Object.entries(enabled)) {
    if (!isOn) {
      continue;
    }

    const entry = registry.find(e => e.key === key);
    if (entry && entry.status === 'not_implemented') {
      errors.push(
        `Cannot enable feature "${key}" because its status is "not_implemented".`,
      );
    }

    const depGroups = dependencies[key] ?? [];
    if (depGroups.length > 0) {
      // At least one group must be fully satisfied
      const isSatisfied = depGroups.some(group =>
        group.every(dep => enabled[dep]),
      );

      if (!isSatisfied) {
        const reqStr = depGroups.map(group => group.join(' AND ')).join(' OR ');
        errors.push(
          `Invalid release config: "${key}" requires (${reqStr}) to be enabled.`,
        );
      }
    }
  }

  return {valid: errors.length === 0, errors};
}
