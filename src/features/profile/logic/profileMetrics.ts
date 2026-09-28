export const PROFILE_EMPTY_METRIC_LABEL = '—';

export function formatProfileWordCount(count: number): string {
  return count > 0 ? String(count) : PROFILE_EMPTY_METRIC_LABEL;
}

export function formatProfileAccuracy(rate: number | null): string {
  return rate === null ? PROFILE_EMPTY_METRIC_LABEL : `${Math.round(rate)}%`;
}
