import {
  probeConnectivity,
  resetConnectivityForTests,
  trackReachability,
  useConnectivityStore,
} from '../connectivity';

const status = () => useConnectivityStore.getState().status;

beforeEach(() => {
  resetConnectivityForTests();
});

describe('connectivity (offline-mode.md)', () => {
  it('goes offline on a transport failure and back online on a response', async () => {
    await expect(
      trackReachability(
        Promise.reject(new TypeError('Network request failed')),
      ),
    ).rejects.toThrow('Network request failed');
    expect(status()).toBe('offline');

    await expect(
      trackReachability(Promise.resolve({status: 500})),
    ).resolves.toEqual({status: 500});
    expect(status()).toBe('online');
  });

  it('ignores an abort the caller asked for', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      trackReachability(
        Promise.reject(new Error('Aborted')),
        controller.signal,
      ),
    ).rejects.toThrow('Aborted');
    expect(status()).toBe('online');
  });

  it('probes the public capabilities route', async () => {
    const fetchImpl = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce({ok: true, status: 200});

    await expect(probeConnectivity(fetchImpl)).resolves.toBe(false);
    expect(status()).toBe('offline');
    await expect(probeConnectivity(fetchImpl)).resolves.toBe(true);
    expect(status()).toBe('online');
    expect(fetchImpl.mock.calls[0][0]).toMatch(/\/v1\/capabilities$/);
  });
});
