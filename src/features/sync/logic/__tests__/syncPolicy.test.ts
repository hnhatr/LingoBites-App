import {
  MAX_SYNC_ATTEMPTS,
  SYNC_RETRY_MAX_MS,
  isSyncStuck,
  syncRetryDelayMs,
} from '../syncPolicy';

describe('syncPolicy', () => {
  it('backs off exponentially from the base delay and caps at the max', () => {
    expect(syncRetryDelayMs(1)).toBe(5_000);
    expect(syncRetryDelayMs(2)).toBe(10_000);
    expect(syncRetryDelayMs(3)).toBe(20_000);
    expect(syncRetryDelayMs(4)).toBe(40_000);
    expect(syncRetryDelayMs(10)).toBe(SYNC_RETRY_MAX_MS);
  });

  it('never backoff below the base delay even for a zero attempt count', () => {
    expect(syncRetryDelayMs(0)).toBe(5_000);
  });

  it('flags a row as stuck only once it reaches the attempt cap', () => {
    expect(isSyncStuck(MAX_SYNC_ATTEMPTS - 1)).toBe(false);
    expect(isSyncStuck(MAX_SYNC_ATTEMPTS)).toBe(true);
  });
});
