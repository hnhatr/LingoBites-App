import {formatCueLabel, formatCueTimestamp} from '../canonicalYouTubeCues';

describe('formatCueLabel', () => {
  it('returns --:-- for null start_ms', () => {
    expect(formatCueLabel(null)).toBe('--:--');
  });

  it('delegates to formatCueTimestamp for numeric ms', () => {
    expect(formatCueLabel(65000)).toBe(formatCueTimestamp(65000));
  });
});
