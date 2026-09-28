/**
 * Side-effect-free pilot metrics public port (TASK-014 / Design r2).
 * Cross-feature callers that need capability progress or privacy-safe export
 * must use this entry (or the root barrel re-exports below) — not the private
 * `data/PilotMetricsRepository` path.
 */
export {
  exportPrivacySafeMetrics,
  formatDurationMs,
  formatPercentage,
  getCapabilityProgressReport,
} from './data/PilotMetricsRepository';
export type {
  CapabilityProgressReport,
  PrivacySafeMetricsExport,
} from './data/PilotMetricsRepository';
