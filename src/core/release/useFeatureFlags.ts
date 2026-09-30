import {useContext} from 'react';

import type {FeatureKey} from './feature-registry';
import {FeatureFlagContext} from './FeatureFlagContext';

export function useFeatureFlags() {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within FeatureFlagProvider');
  }
  return context;
}

export function useFeatureEnabled(key: FeatureKey): boolean {
  return useFeatureFlags().isFeatureEnabled(key);
}
