import {sanitizeAnalyticsPayload} from '../sanitizeAnalyticsPayload';
import type {
  AnalyticsAdapter,
  AnalyticsEventName,
  AnalyticsProperties,
} from '../types';

export function createConsoleAnalyticsAdapter(): AnalyticsAdapter {
  return {
    track(event: AnalyticsEventName, properties?: AnalyticsProperties) {
      const payload = sanitizeAnalyticsPayload(properties ?? {});
      if (__DEV__) {
        console.info('[analytics]', event, payload);
      }
    },
  };
}
