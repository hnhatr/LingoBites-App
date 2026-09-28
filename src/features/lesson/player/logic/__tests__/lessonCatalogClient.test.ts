import * as AuthSession from '@shared/auth/authSession';
import {
  fetchLessonCatalogPage,
  UnifiedLessonCatalogResponseSchema,
} from '../lessonCatalogClient';

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

const SUMMARY_A = {
  id: '00000000-0000-4000-8000-000000000010',
  title: 'Global lesson',
  description: 'Admin authored',
  estimatedMinutes: 7,
  contentRevision: 3,
  updatedAt: '2026-09-25T10:00:00.000Z',
};

const SUMMARY_B = {
  id: '00000000-0000-4000-8000-000000000011',
  title: 'Personal lesson',
  description: 'AI generated',
  estimatedMinutes: null,
  contentRevision: 1,
  updatedAt: '2026-09-25T11:00:00.000Z',
};

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Headers(),
  json: jest.fn().mockResolvedValue(body),
});

describe('fetchLessonCatalogPage', () => {
  beforeEach(() => {
    jest
      .spyOn(AuthSession, 'ensureValidSession')
      .mockResolvedValue(validSession);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fetches the catalog path with default limit and parses summaries', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({
        request_id: 'req-1',
        status: 'success',
        lessons: [SUMMARY_A, SUMMARY_B],
        next_cursor: 'cursor-2',
      }),
    );
    const result = await fetchLessonCatalogPage({fetchImpl});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lessons).toHaveLength(2);
    expect(result.nextCursor).toBe('cursor-2');
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/api/v1/lessons?limit=20');
    expect(init.method).toBe('GET');
  });

  it('forwards explicit limit and cursor', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({
        request_id: 'req-2',
        status: 'success',
        lessons: [],
        next_cursor: null,
      }),
    );
    const result = await fetchLessonCatalogPage({
      limit: 5,
      cursor: 'cursor-abc',
      fetchImpl,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nextCursor).toBeNull();
    const [url] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('limit=5');
    expect(url).toContain('cursor=cursor-abc');
  });

  it('rejects an out-of-range limit locally without a network call', async () => {
    const fetchImpl = jest.fn();
    const result = await fetchLessonCatalogPage({limit: 500, fetchImpl});
    expect(result).toMatchObject({ok: false, kind: 'content-error'});
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns no origin discriminator from parsed summaries', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({
        request_id: 'req-3',
        status: 'success',
        lessons: [SUMMARY_A],
        next_cursor: null,
      }),
    );
    const result = await fetchLessonCatalogPage({fetchImpl});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect('origin' in result.lessons[0]).toBe(false);
    expect('owner_user_id' in result.lessons[0]).toBe(false);
    expect(
      UnifiedLessonCatalogResponseSchema.safeParse({
        request_id: 'req-3',
        status: 'success',
        lessons: [{...SUMMARY_A, origin: 'admin'}],
        next_cursor: null,
      }).success,
    ).toBe(false);
  });

  it('maps 401 to auth-error and 500 to retryable server-error', async () => {
    const authed = jest.fn().mockResolvedValue(jsonResponse({}, 401));
    await expect(
      fetchLessonCatalogPage({fetchImpl: authed}),
    ).resolves.toMatchObject({ok: false, kind: 'auth-error'});

    const failed = jest.fn().mockResolvedValue(jsonResponse({}, 500));
    await expect(
      fetchLessonCatalogPage({fetchImpl: failed}),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'server-error',
      retryable: true,
    });
  });

  it('maps an invalid body to content-error', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({nope: true}));
    await expect(fetchLessonCatalogPage({fetchImpl})).resolves.toMatchObject({
      ok: false,
      kind: 'content-error',
    });
  });

  it('maps a transport throw to retryable network-error', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('down'));
    await expect(fetchLessonCatalogPage({fetchImpl})).resolves.toMatchObject({
      ok: false,
      kind: 'network-error',
    });
  });

  it('resolves cancelled without a network call on an aborted signal', async () => {
    const fetchImpl = jest.fn();
    const controller = new AbortController();
    controller.abort();
    await expect(
      fetchLessonCatalogPage({fetchImpl, signal: controller.signal}),
    ).resolves.toMatchObject({ok: false, cancelled: true});
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
