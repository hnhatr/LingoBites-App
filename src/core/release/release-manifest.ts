import dev from './configs/dev';
import production from './configs/production';
import type {ReleaseConfig} from './types';

export const DEFAULT_RELEASE_NAME = 'production';

export type ReleaseConfigName = 'dev' | 'production';

const releaseConfigs: Record<ReleaseConfigName, ReleaseConfig> = {
  dev: dev as ReleaseConfig,
  production: production as ReleaseConfig,
};

export function getReleaseConfig(
  releaseName: ReleaseConfigName = DEFAULT_RELEASE_NAME,
): ReleaseConfig {
  const config = releaseConfigs[releaseName];
  if (!config) {
    throw new Error(`Unknown release config: ${releaseName}`);
  }
  return config;
}

export function listReleaseConfigNames(): ReleaseConfigName[] {
  return Object.keys(releaseConfigs) as ReleaseConfigName[];
}
