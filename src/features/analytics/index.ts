export {createConsoleAnalyticsAdapter} from './logic/adapters/ConsoleAnalyticsAdapter';
export {createFirebaseAnalyticsAdapter} from './logic/adapters/FirebaseAnalyticsAdapter';
export {
  createInMemoryAnalyticsAdapter,
  type RecordedAnalyticsEvent,
} from './logic/adapters/InMemoryAnalyticsAdapter';
export {
  getImageSizeCategory,
  resetAnalyticsAdapter,
  setAnalyticsAdapter,
  trackAppOpened,
  trackEvent,
} from './logic/analyticsService';
export {
  getTextLengthBucket,
  type TextLengthBucket,
} from './logic/textLengthBucket';
export {sanitizeAnalyticsPayload} from './logic/sanitizeAnalyticsPayload';
export type {
  AnalyticsAdapter,
  AnalyticsEventName,
  InputMethod,
} from './logic/types';
export {
  exportPrivacySafeMetrics,
  formatDurationMs,
  formatPercentage,
  getCapabilityProgressReport,
} from './logic/pilotMetricsPort';
export type {
  CapabilityProgressReport,
  PrivacySafeMetricsExport,
} from './logic/pilotMetricsPort';
