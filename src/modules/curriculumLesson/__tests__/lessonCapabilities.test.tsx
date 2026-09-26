import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {
  fetchLessonServerCapabilities,
  isUnifiedLessonReady,
  useLessonServerCapabilities,
} from '../lessonCapabilities';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(ok: boolean, body: unknown) {
  return {
    ok,
    json: async () => body,
  };
}

function fullCapsBody(overrides: Record<string, boolean> = {}) {
  return {
    capabilities: {
      youtube: {enabled: true},
      lessons: {
        catalog: true,
        canonical_delivery: true,
        ai_materialization: true,
        packaged_import: true,
        partial_retry: true,
        private_library: true,
        ...overrides,
      },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchLessonServerCapabilities', () => {
  it('parses the full lessons capability set', async () => {
    mockFetch.mockResolvedValue(jsonResponse(true, fullCapsBody()));
    await expect(fetchLessonServerCapabilities()).resolves.toEqual({
      catalog: true,
      canonicalDelivery: true,
      aiMaterialization: true,
      packagedImport: true,
      partialRetry: true,
      privateLibrary: true,
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/v1/capabilities',
      expect.objectContaining({headers: {Accept: 'application/json'}}),
    );
  });

  it('resolves an old server without a lessons key to all-false', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(true, {capabilities: {youtube: {enabled: true}}}),
    );
    await expect(fetchLessonServerCapabilities()).resolves.toEqual({
      catalog: false,
      canonicalDelivery: false,
      aiMaterialization: false,
      packagedImport: false,
      partialRetry: false,
      privateLibrary: false,
    });
  });

  it('fails closed when the TASK-004 fields are missing (pre-retry server)', async () => {
    const {lessons, ...rest} = (
      fullCapsBody() as {capabilities: Record<string, unknown>}
    ).capabilities as unknown as {
      lessons: Record<string, boolean>;
    } & Record<string, unknown>;
    const {partial_retry, private_library, ...legacyLessons} = lessons;
    expect(partial_retry).toBe(true);
    expect(private_library).toBe(true);
    mockFetch.mockResolvedValue(
      jsonResponse(true, {capabilities: {...rest, lessons: legacyLessons}}),
    );
    await expect(fetchLessonServerCapabilities()).resolves.toEqual({
      catalog: false,
      canonicalDelivery: false,
      aiMaterialization: false,
      packagedImport: false,
      partialRetry: false,
      privateLibrary: false,
    });
  });

  it('fails closed on non-OK status, invalid body, and network errors', async () => {
    const allOff = {
      catalog: false,
      canonicalDelivery: false,
      aiMaterialization: false,
      packagedImport: false,
      partialRetry: false,
      privateLibrary: false,
    };
    mockFetch.mockResolvedValue(jsonResponse(false, fullCapsBody()));
    await expect(fetchLessonServerCapabilities()).resolves.toEqual(allOff);

    mockFetch.mockResolvedValue(jsonResponse(true, {nope: true}));
    await expect(fetchLessonServerCapabilities()).resolves.toEqual(allOff);

    mockFetch.mockRejectedValue(new Error('network down'));
    await expect(fetchLessonServerCapabilities()).resolves.toEqual(allOff);
  });
});

describe('isUnifiedLessonReady', () => {
  const on = {
    catalog: true,
    canonicalDelivery: true,
    aiMaterialization: true,
    packagedImport: true,
    partialRetry: true,
    privateLibrary: true,
  };
  const off = {
    catalog: false,
    canonicalDelivery: false,
    aiMaterialization: false,
    packagedImport: false,
    partialRetry: false,
    privateLibrary: false,
  };

  it('requires all canonical capabilities when flag is not false', () => {
    expect(isUnifiedLessonReady({}, on)).toBe(true);
    expect(isUnifiedLessonReady({unifiedLesson: false}, on)).toBe(false);
    expect(isUnifiedLessonReady({}, off)).toBe(false);
    expect(
      isUnifiedLessonReady({}, {...on, catalog: false}),
    ).toBe(false);
    expect(
      isUnifiedLessonReady(
        {},
        {...on, aiMaterialization: false},
      ),
    ).toBe(false);
  });

  it('stays off when targeted retry or the private library is unavailable', () => {
    expect(
      isUnifiedLessonReady({}, {...on, partialRetry: false}),
    ).toBe(false);
    expect(
      isUnifiedLessonReady(
        {},
        {...on, privateLibrary: false},
      ),
    ).toBe(false);
  });

  it('does not gate on packaged import (separate content concern)', () => {
    expect(
      isUnifiedLessonReady(
        {unifiedLesson: true},
        {...on, packagedImport: false},
      ),
    ).toBe(true);
  });
});

function Probe({enabled}: {enabled: boolean}) {
  const caps = useLessonServerCapabilities(enabled);
  return <>{caps.catalog && caps.aiMaterialization ? 'on' : 'off'}</>;
}

async function renderProbe(enabled: boolean) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(<Probe enabled={enabled} />);
    await Promise.resolve();
  });
  return tree;
}

describe('useLessonServerCapabilities', () => {
  it('never probes while disabled', async () => {
    const tree = await renderProbe(false);
    expect(tree.toJSON()).toBe('off');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('resolves ready capabilities after the probe', async () => {
    mockFetch.mockResolvedValue(jsonResponse(true, fullCapsBody()));
    const tree = await renderProbe(true);
    await act(async () => {
      await Promise.resolve();
    });
    expect(tree.toJSON()).toBe('on');
  });
});
