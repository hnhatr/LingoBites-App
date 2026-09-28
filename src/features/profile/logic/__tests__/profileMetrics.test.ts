import {
  formatProfileAccuracy,
  formatProfileWordCount,
  PROFILE_EMPTY_METRIC_LABEL,
} from '../profileMetrics';

describe('profileMetrics', () => {
  it('shows an explicit empty label when word count is zero', () => {
    expect(formatProfileWordCount(0)).toBe(PROFILE_EMPTY_METRIC_LABEL);
  });

  it('formats a positive word count as a string', () => {
    expect(formatProfileWordCount(42)).toBe('42');
  });

  it('shows an explicit empty label when accuracy is unavailable', () => {
    expect(formatProfileAccuracy(null)).toBe(PROFILE_EMPTY_METRIC_LABEL);
  });

  it('formats repository accuracy as a rounded percentage', () => {
    expect(formatProfileAccuracy(84.6)).toBe('85%');
  });
});
