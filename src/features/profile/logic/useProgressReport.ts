import {
  exportPrivacySafeMetrics,
  formatPercentage,
  getCapabilityProgressReport,
} from '@features/analytics';
import type {CapabilityProgressReport} from '@features/analytics';

export type {CapabilityProgressReport};

/**
 * Settings-facing facade for pilot-metrics reads. Screens call this instead of
 * importing `@modules/analytics` directly so settings stays the documented
 * entry for profile/progress UI (SETE-118 Việc 3).
 *
 * Each member forwards to the analytics public port at call time (not captured
 * once into an object) so `jest.spyOn` on the analytics module in existing
 * tests keeps working through this indirection.
 */
export function useProgressReport() {
  return progressReport;
}

const progressReport = {
  getCapabilityProgressReport: (
    ...args: Parameters<typeof getCapabilityProgressReport>
  ) => getCapabilityProgressReport(...args),
  exportPrivacySafeMetrics: (
    ...args: Parameters<typeof exportPrivacySafeMetrics>
  ) => exportPrivacySafeMetrics(...args),
  formatPercentage: (...args: Parameters<typeof formatPercentage>) =>
    formatPercentage(...args),
};
