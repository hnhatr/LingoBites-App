import {formatCacheBytes} from '../audioCachePolicy';

describe('audioCachePolicy', () => {
  it('formats byte counts for the settings UI', () => {
    expect(formatCacheBytes(0)).toBe('0 MB');
    expect(formatCacheBytes(5 * 1024)).toBe('5 KB');
    expect(formatCacheBytes(12.4 * 1024 * 1024)).toBe('12 MB');
    expect(formatCacheBytes(50 * 1024 * 1024)).toBe('50 MB');
  });
});
