import {sanitizeAnalyticsPayload} from '../sanitizeAnalyticsPayload';
import type {
  AnalyticsAdapter,
  AnalyticsEventName,
  AnalyticsProperties,
} from '../types';

export type RecordedAnalyticsEvent = {
  event: AnalyticsEventName;
  properties: Record<string, string | number | boolean>;
};

export function createInMemoryAnalyticsAdapter(): AnalyticsAdapter & {
  getEvents: () => RecordedAnalyticsEvent[];
  clear: () => void;
} {
  const events: RecordedAnalyticsEvent[] = [];

  return {
    track(event: AnalyticsEventName, properties?: AnalyticsProperties) {
      events.push({
        event,
        properties: sanitizeAnalyticsPayload(properties ?? {}),
      });
    },
    getEvents() {
      return [...events];
    },
    clear() {
      events.length = 0;
    },
  };
}
