import * as AuthSession from '@shared/auth/authSession';
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {
  useLessonCatalog,
  type UseLessonCatalogResult,
} from '../useLessonCatalog';

const validSession = {
  status: 'valid' as const,
  session: {
    access_token: 'test-token',
    session_id: '1',
    refresh_token: '2',
    access_expires_at: '2050',
    refresh_expires_at: '2050',
  },
  userId: 'user1',
};

function summary(id: string) {
  return {
    id,
    title: `Lesson ${id.slice(-4)}`,
    description: 'Desc',
    estimatedMinutes: 5,
    contentRevision: 1,
    updatedAt: '2026-09-25T10:00:00.000Z',
  };
}

const PAGE_1 = {
  request_id: 'r1',
  status: 'success',
  lessons: [summary('00000000-0000-4000-8000-000000000010')],
  next_cursor: 'c2',
};

const PAGE_2 = {
  request_id: 'r2',
  status: 'success',
  lessons: [summary('00000000-0000-4000-8000-000000000011')],
  next_cursor: null,
};

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Headers(),
  json: jest.fn().mockResolvedValue(body),
});

function Probe({
  fetchImpl,
  capture,
}: {
  fetchImpl?: typeof fetch;
  capture: (result: UseLessonCatalogResult) => void;
}) {
  const result = useLessonCatalog({fetchImpl});
  capture(result);
  return null;
}

async function renderProbe(fetchImpl?: typeof fetch) {
  let latest!: UseLessonCatalogResult;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <Probe fetchImpl={fetchImpl} capture={result => (latest = result)} />,
    );
  });
  return {
    tree,
    latest: () => latest,
  };
}

describe('useLessonCatalog', () => {
  beforeEach(() => {
    jest
      .spyOn(AuthSession, 'ensureValidSession')
      .mockResolvedValue(validSession);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads the first page and appends the next cursor page', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(PAGE_1))
      .mockResolvedValueOnce(jsonResponse(PAGE_2));
    const probe = await renderProbe(fetchImpl as unknown as typeof fetch);
    expect(probe.latest().status).toBe('ready');
    expect(probe.latest().items).toHaveLength(1);

    await act(async () => {
      probe.latest().loadMore();
    });
    expect(probe.latest().status).toBe('ready');
    expect(probe.latest().items).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('refresh resets to the first page', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(PAGE_1))
      .mockResolvedValueOnce(jsonResponse(PAGE_2))
      .mockResolvedValueOnce(jsonResponse(PAGE_1));
    const probe = await renderProbe(fetchImpl as unknown as typeof fetch);
    await act(async () => {
      probe.latest().loadMore();
    });
    expect(probe.latest().items).toHaveLength(2);
    await act(async () => {
      probe.latest().refresh();
    });
    expect(probe.latest().status).toBe('ready');
    expect(probe.latest().items).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('surfaces errors while keeping loaded items', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(PAGE_1))
      .mockResolvedValueOnce(jsonResponse({}, 500));
    const probe = await renderProbe(fetchImpl as unknown as typeof fetch);
    await act(async () => {
      probe.latest().loadMore();
    });
    expect(probe.latest().status).toBe('error');
    expect(probe.latest().items).toHaveLength(1);
  });

  it('discards a stale first page after refresh wins the race', async () => {
    let resolveFirst!: (value: unknown) => void;
    const first = new Promise(resolve => (resolveFirst = resolve));
    const fetchImpl = jest
      .fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValueOnce(jsonResponse(PAGE_2));
    let latest!: UseLessonCatalogResult;
    await act(async () => {
      ReactTestRenderer.create(
        <Probe
          fetchImpl={fetchImpl as unknown as typeof fetch}
          capture={r => (latest = r)}
        />,
      );
    });
    await act(async () => {
      latest.refresh();
    });
    await act(async () => {
      resolveFirst(jsonResponse(PAGE_1));
    });
    expect(latest.status).toBe('ready');
    expect(latest.items.map(item => item.id)).toEqual([
      '00000000-0000-4000-8000-000000000011',
    ]);
  });
});
