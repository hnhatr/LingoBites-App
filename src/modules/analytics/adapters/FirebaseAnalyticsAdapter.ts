import type {
  AnalyticsAdapter,
  AnalyticsEventName,
  AnalyticsProperties,
} from '../types';
import {sanitizeAnalyticsPayload} from '../sanitizeAnalyticsPayload';
import {createConsoleAnalyticsAdapter} from './ConsoleAnalyticsAdapter';

/**
 * Placeholder until @react-native-firebase/analytics is wired per
 * docs/01-ba/07-release/04-public-app-setup-checklist.md §12.
 * Routes events through console adapter so funnel code stays testable.
 */
export function createFirebaseAnalyticsAdapter(): AnalyticsAdapter {
  const fallback = createConsoleAnalyticsAdapter();

  return {
    track(event: AnalyticsEventName, properties?: AnalyticsProperties) {
      if (__DEV__) {
        console.info(
          '[analytics:firebase-stub]',
          'Replace with @react-native-firebase/analytics when Firebase project is ready.',
        );
      }

      const payload = sanitizeAnalyticsPayload(properties ?? {});
      fallback.track(event, payload);
    },
  };
}
