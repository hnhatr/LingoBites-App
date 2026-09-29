import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {
  fetchYouTubeCapability,
  useYouTubeServerEnabled,
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

function Probe() {
  const enabled = useYouTubeServerEnabled();
  return <>{enabled ? 'on' : 'off'}</>;
}

async function renderProbe() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(<Probe />);
    await Promise.resolve();
  });
  return tree;
}

describe('useYouTubeServerEnabled (SETE-290 DEV-1)', () => {
  it('starts disabled while the probe is in flight', async () => {
    let resolveFetch!: (value: unknown) => void;
    mockFetch.mockReturnValue(
      new Promise(resolve => {
        resolveFetch = resolve;
      }),
    );
    const tree = await renderProbe();
    expect(tree.toJSON()).toBe('off');
    await act(async () => {
      resolveFetch(jsonResponse(true, enabledBody(true)));
      await Promise.resolve();
    });
    expect(tree.toJSON()).toBe('on');
  });

  it('stays disabled when the probe fails', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));
    const tree = await renderProbe();
    await act(async () => {
      await Promise.resolve();
    });
    expect(tree.toJSON()).toBe('off');
  });
});
