import {createTimeoutSignal, raceWithTimeout, TIMED_OUT} from '../timeout';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('createTimeoutSignal', () => {
  it('aborts when the timer fires and reports the timeout', () => {
    const timeout = createTimeoutSignal(1000);
    expect(timeout.signal.aborted).toBe(false);
    jest.advanceTimersByTime(1000);
    expect(timeout.signal.aborted).toBe(true);
    expect(timeout.timedOut()).toBe(true);
  });

  it('aborts when the caller aborts, without counting it as a timeout', () => {
    const caller = new AbortController();
    const timeout = createTimeoutSignal(1000, caller.signal);
    caller.abort();
    expect(timeout.signal.aborted).toBe(true);
    expect(timeout.timedOut()).toBe(false);
  });

  it('starts aborted when the caller signal already is', () => {
    const caller = new AbortController();
    caller.abort();
    const timeout = createTimeoutSignal(1000, caller.signal);
    expect(timeout.signal.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cleanup clears the timer and detaches from the caller signal', () => {
    const caller = new AbortController();
    const remove = jest.spyOn(caller.signal, 'removeEventListener');
    const timeout = createTimeoutSignal(1000, caller.signal);
    timeout.cleanup();

    expect(jest.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    caller.abort();
    expect(timeout.signal.aborted).toBe(false);
  });
});

describe('raceWithTimeout', () => {
  it('resolves to the value when the promise settles first', async () => {
    await expect(raceWithTimeout(Promise.resolve('ok'), 1000)).resolves.toBe(
      'ok',
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it('resolves to TIMED_OUT when the promise is too slow', async () => {
    const result = raceWithTimeout(new Promise<never>(() => {}), 1000);
    jest.advanceTimersByTime(1000);
    await expect(result).resolves.toBe(TIMED_OUT);
  });
});
