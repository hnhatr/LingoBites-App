import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {
  fetchYouTubeCapability,
  useYouTubeCapability,
} from '../youtubeCapabilities';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function enabledBody(enabled: boolean) {
  return {capabilities: {youtube: {enabled}}};
}

function jsonResponse(ok: boolean, body: unknown) {
  return {
    ok,
    json: async () => body,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchYouTubeCapability (SETE-290 DEV-1)', () => {
  it('returns true when the server reports youtube enabled', async () => {
    mockFetch.mockResolvedValue(jsonResponse(true, enabledBody(true)));
    await expect(fetchYouTubeCapability()).resolves.toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/v1/capabilities',
      expect.objectContaining({headers: {Accept: 'application/json'}}),
    );
  });

  it('returns false when the server reports youtube disabled', async () => {
    mockFetch.mockResolvedValue(jsonResponse(true, enabledBody(false)));
    await expect(fetchYouTubeCapability()).resolves.toBe(false);
  });

  it('fails closed on non-OK status, invalid body, and network errors', async () => {
    mockFetch.mockResolvedValue(jsonResponse(false, enabledBody(true)));
    await expect(fetchYouTubeCapability()).resolves.toBe(false);

    mockFetch.mockResolvedValue(jsonResponse(true, {capabilities: {}}));
    await expect(fetchYouTubeCapability()).resolves.toBe(false);

    mockFetch.mockRejectedValue(new Error('network down'));
    await expect(fetchYouTubeCapability()).resolves.toBe(false);
  });
});

let latest!: ReturnType<typeof useYouTubeCapability>;

function Probe() {
  latest = useYouTubeCapability();
  return <>{latest.status}</>;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function renderProbe() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(<Probe />);
  });
  await flush();
  return tree;
}

describe('useYouTubeCapability (SETE-290 DEV-1)', () => {
  it('is checking while the probe is in flight, then enabled', async () => {
    let resolveFetch!: (value: unknown) => void;
    mockFetch.mockReturnValue(
      new Promise(resolve => {
        resolveFetch = resolve;
      }),
    );
    const tree = await renderProbe();
    expect(tree.toJSON()).toBe('checking');
    await act(async () => {
      resolveFetch(jsonResponse(true, enabledBody(true)));
    });
    await flush();
    expect(tree.toJSON()).toBe('enabled');
  });

  it('is disabled when the probe fails', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));
    const tree = await renderProbe();
    expect(tree.toJSON()).toBe('disabled');
  });

  it('probes without an auth header (public endpoint)', async () => {
    mockFetch.mockResolvedValue(jsonResponse(true, enabledBody(true)));
    await renderProbe();
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/v1/capabilities',
      expect.objectContaining({headers: {Accept: 'application/json'}}),
    );
  });

  it('recovers on refresh after a failed first probe', async () => {
    mockFetch.mockRejectedValueOnce(new Error('offline'));
    const tree = await renderProbe();
    expect(tree.toJSON()).toBe('disabled');

    mockFetch.mockResolvedValue(jsonResponse(true, enabledBody(true)));
    await act(async () => {
      latest.refresh();
    });
    await flush();
    expect(tree.toJSON()).toBe('enabled');
  });

  it('keeps enabled when a later refresh fails', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(true, enabledBody(true)));
    const tree = await renderProbe();
    expect(tree.toJSON()).toBe('enabled');

    mockFetch.mockRejectedValue(new Error('offline'));
    await act(async () => {
      latest.refresh();
    });
    await flush();
    expect(tree.toJSON()).toBe('enabled');
  });
});
