import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {useCanonicalCatalog} from '../useCanonicalCatalog';

const mockFetchLessonCatalog = jest.fn();
const mockListLessonDownloads = jest.fn();

jest.mock('../canonicalLessonClient', () => ({
  fetchLessonCatalog: (...args: unknown[]) => mockFetchLessonCatalog(...args),
}));

jest.mock('../canonicalDownloadRepository', () => ({
  listLessonDownloads: () => mockListLessonDownloads(),
}));

const download = (id: string, sourceType: string) => ({
  lessonId: id,
  snapshot: {
    id,
    title: `Lesson ${id}`,
    description: '',
    origin: 'admin',
    source_type: sourceType,
    content_revision: 2,
    unit: null,
    youtube: null,
    sentences: [{}, {}],
  },
});

async function loadCatalog(filter = {}) {
  let latest!: ReturnType<typeof useCanonicalCatalog>;
  function Probe() {
    latest = useCanonicalCatalog(filter);
    return null;
  }
  await act(async () => {
    ReactTestRenderer.create(<Probe />);
  });
  await act(async () => {
    await latest.refresh();
  });
  return latest.state;
}

beforeEach(() => {
  mockFetchLessonCatalog.mockReset();
  mockListLessonDownloads.mockReset();
});

describe('useCanonicalCatalog offline (offline-mode.md #9)', () => {
  it('falls back to downloaded lessons on a network error', async () => {
    mockFetchLessonCatalog.mockResolvedValue({
      ok: false,
      kind: 'network-error',
      message: 'offline',
    });
    mockListLessonDownloads.mockReturnValue([
      download('a', 'text'),
      download('b', 'youtube'),
    ]);

    const state = await loadCatalog({sourceType: 'text'});

    expect(state).toMatchObject({
      status: 'ready',
      offline: true,
      nextCursor: null,
      lessons: [{id: 'a', sentence_count: 2, content_revision: 2}],
    });
  });

  it('keeps the error when nothing is downloaded', async () => {
    mockFetchLessonCatalog.mockResolvedValue({
      ok: false,
      kind: 'network-error',
      message: 'offline',
    });
    mockListLessonDownloads.mockReturnValue([]);

    expect((await loadCatalog()).status).toBe('error');
  });

  it('does not fall back on a Server error', async () => {
    mockFetchLessonCatalog.mockResolvedValue({
      ok: false,
      kind: 'server-error',
      message: 'down',
    });
    mockListLessonDownloads.mockReturnValue([download('a', 'text')]);

    expect((await loadCatalog()).status).toBe('error');
  });
});
