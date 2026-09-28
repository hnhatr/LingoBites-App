import * as AuthSession from '@shared/auth/authSession';
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {
  useLessonGenerationJob,
  type UseLessonGenerationJobResult,
} from '../useLessonGenerationJob';

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

const JOB_ID = '00000000-0000-4000-8000-000000000070';
const LESSON_ID = '00000000-0000-4000-8000-000000000071';

const FAILED_CHUNK = {
  id: 'c1',
  status: 'failed',
  attempts: 2,
  errorCode: 'AI_UNIT_INVALID_OUTPUT',
  retryable: true,
  revision: 2,
};

const READY_CHUNK = {
  id: 'c0',
  status: 'ready',
  attempts: 1,
  errorCode: null,
  retryable: false,
  revision: 1,
};

function jobEnvelope(status: string, overrides: Record<string, unknown> = {}) {
  return {
    request_id: 'req-1',
    status: 'success',
    job: {
      id: JOB_ID,
      status,
      revision: 2,
      pollAfterMs: 500,
      lessonId: null,
      chunks: [],
      units: [],
      error: null,
      warnings: [],
      ...overrides,
    },
  };
}

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Headers(),
  json: jest.fn().mockResolvedValue(body),
});

function Probe({
  jobId,
  fetchImpl,
  capture,
}: {
  jobId: string;
  fetchImpl?: typeof fetch;
  capture: (result: UseLessonGenerationJobResult) => void;
}) {
  const result = useLessonGenerationJob({jobId, fetchImpl});
  capture(result);
  return null;
}

describe('useLessonGenerationJob', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest
      .spyOn(AuthSession, 'ensureValidSession')
      .mockResolvedValue(validSession);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function renderProbe(fetchImpl: jest.Mock) {
    let latest!: UseLessonGenerationJobResult;
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <Probe
          jobId={JOB_ID}
          fetchImpl={fetchImpl as unknown as typeof fetch}
          capture={result => (latest = result)}
        />,
      );
    });
    return {latest: () => latest, tree: () => tree};
  }

  function generationOf(probe: {latest: () => UseLessonGenerationJobResult}) {
    return probe.latest().generation;
  }

  it('polls until the materialized lesson id is stable', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(jobEnvelope('partially_ready')))
      .mockResolvedValueOnce(
        jsonResponse(jobEnvelope('ready', {revision: 4, lessonId: LESSON_ID})),
      );
    const probe = await renderProbe(fetchImpl);
    expect(generationOf(probe).status).toBe('polling');

    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(generationOf(probe)).toMatchObject({
      status: 'succeeded',
      lessonId: LESSON_ID,
    });
  });

  it('maps a terminal failure to a retryable failed state', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(
          jobEnvelope('failed', {error: {code: 'X', message: 'Boom.'}}),
        ),
      );
    const probe = await renderProbe(fetchImpl);
    const latest = generationOf(probe);
    expect(latest.status).toBe('failed');
    if (latest.status !== 'failed') return;
    expect(latest.error.retryable).toBe(true);
    expect(latest.error.message).toBe('Boom.');
  });

  it('treats a foreign job as failed without crashing', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(
        {
          request_id: 'r1',
          status: 'failed',
          error: {code: 'LESSON_NOT_FOUND', message: 'Gone.'},
        },
        404,
      ),
    );
    const probe = await renderProbe(fetchImpl);
    expect(generationOf(probe).status).toBe('failed');
  });

  it('stops polling after unmount without committing', async () => {
    let resolvePoll!: (value: unknown) => void;
    const fetchImpl = jest.fn(
      () =>
        new Promise(resolve => {
          resolvePoll = resolve;
        }),
    );
    const probe = await renderProbe(fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await act(async () => {
      probe.tree().unmount();
    });
    await act(async () => {
      resolvePoll(jsonResponse(jobEnvelope('ready', {lessonId: LESSON_ID})));
      jest.advanceTimersByTime(60_000);
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries only the selected target and preserves successful parts', async () => {
    const partial = jobEnvelope('partially_ready', {
      revision: 3,
      chunks: [READY_CHUNK, FAILED_CHUNK],
    });
    const accepted = jobEnvelope('partially_ready', {
      revision: 4,
      chunks: [
        READY_CHUNK,
        {...FAILED_CHUNK, status: 'processing', revision: 3},
      ],
    });
    let retried = false;
    const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        retried = true;
        return jsonResponse(accepted);
      }
      return jsonResponse(retried ? accepted : partial);
    });
    const probe = await renderProbe(fetchImpl);
    expect(generationOf(probe)).toMatchObject({
      status: 'polling',
      job: {revision: 3},
    });

    let outcome!: Awaited<
      ReturnType<UseLessonGenerationJobResult['retryPart']>
    >;
    await act(async () => {
      outcome = await probe.latest().retryPart({kind: 'chunk', id: 'c1'});
    });
    expect(outcome.ok).toBe(true);

    const posts = fetchImpl.mock.calls.filter(
      ([, init]) => (init as RequestInit)?.method === 'POST',
    );
    expect(posts).toHaveLength(1);
    const [postUrl, postInit] = posts[0] as [string, RequestInit];
    expect(postUrl).toBe(
      `http://localhost:3000/api/v1/lesson-jobs/${JOB_ID}/chunks/c1/retry`,
    );
    expect(JSON.parse(postInit.body as string)).toMatchObject({
      expected_revision: 3,
    });
    expect(
      (postInit.headers as Record<string, string>)['Idempotency-Key'],
    ).toMatch(/.+/);
    if (outcome.ok) {
      expect(outcome.job.chunks.find(chunk => chunk.id === 'c0')?.status).toBe(
        'ready',
      );
    }
    expect(generationOf(probe)).toMatchObject({
      status: 'polling',
      job: {revision: 4},
    });
  });

  it('refetches the snapshot on 409 without a second mutation', async () => {
    const failed = jobEnvelope('failed', {
      revision: 3,
      chunks: [READY_CHUNK, FAILED_CHUNK],
      error: {code: 'X', message: 'Boom.'},
    });
    const refreshed = jobEnvelope('partially_ready', {
      revision: 5,
      chunks: [READY_CHUNK, {...FAILED_CHUNK, status: 'processing'}],
    });
    const conflictBody = {
      request_id: 'r1',
      status: 'failed',
      error: {code: 'JOB_REVISION_CONFLICT', message: 'Stale.'},
    };
    const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return jsonResponse(conflictBody, 409);
      if (
        fetchImpl.mock.calls.filter(
          ([, i]) => (i as RequestInit)?.method === 'GET',
        ).length > 1
      ) {
        return jsonResponse(refreshed);
      }
      return jsonResponse(failed);
    });
    const probe = await renderProbe(fetchImpl);
    expect(generationOf(probe)).toMatchObject({status: 'failed'});

    let outcome!: Awaited<
      ReturnType<UseLessonGenerationJobResult['retryPart']>
    >;
    await act(async () => {
      outcome = await probe.latest().retryPart({kind: 'chunk', id: 'c1'});
    });
    expect(outcome).toMatchObject({ok: false, conflicted: true});
    if (!outcome.ok) {
      expect(outcome.error).toMatchObject({
        kind: 'conflict',
        errorCode: 'JOB_REVISION_CONFLICT',
      });
      expect(outcome.job?.revision).toBe(5);
    }
    const posts = fetchImpl.mock.calls.filter(
      ([, init]) => (init as RequestInit)?.method === 'POST',
    );
    expect(posts).toHaveLength(1);
    expect(generationOf(probe)).toMatchObject({
      status: 'polling',
      job: {revision: 5},
    });
  });

  it('suppresses a duplicate retry while one is in flight', async () => {
    const partial = jobEnvelope('partially_ready', {
      revision: 3,
      chunks: [READY_CHUNK, FAILED_CHUNK],
    });
    let resolvePost!: (value: unknown) => void;
    const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return new Promise(resolve => {
          resolvePost = resolve;
        });
      }
      return jsonResponse(partial);
    });
    const probe = await renderProbe(fetchImpl);

    let first!: Promise<
      Awaited<ReturnType<UseLessonGenerationJobResult['retryPart']>>
    >;
    await act(async () => {
      first = probe.latest().retryPart({kind: 'chunk', id: 'c1'});
    });
    let second!: Awaited<ReturnType<UseLessonGenerationJobResult['retryPart']>>;
    await act(async () => {
      second = await probe.latest().retryPart({kind: 'chunk', id: 'c1'});
    });
    expect(second).toMatchObject({
      ok: false,
      conflicted: false,
      error: {errorCode: 'RETRY_IN_FLIGHT'},
    });
    await act(async () => {
      resolvePost(jsonResponse(partial));
      await first;
    });
    const posts = fetchImpl.mock.calls.filter(
      ([, init]) => (init as RequestInit)?.method === 'POST',
    );
    expect(posts).toHaveLength(1);
  });

  it('makes no mutation without a job snapshot', async () => {
    const fetchImpl = jest.fn(
      () =>
        new Promise(() => {
          // Never resolves: no snapshot is ever committed.
        }),
    );
    const probe = await renderProbe(fetchImpl);
    let outcome!: Awaited<
      ReturnType<UseLessonGenerationJobResult['retryPart']>
    >;
    await act(async () => {
      outcome = await probe.latest().retryPart({kind: 'unit', key: 'grammar'});
    });
    expect(outcome).toMatchObject({
      ok: false,
      error: {errorCode: 'NO_JOB_SNAPSHOT'},
    });
    const posts = fetchImpl.mock.calls.filter((...args: unknown[]) => {
      const init = args[1] as RequestInit | undefined;
      return init?.method === 'POST';
    });
    expect(posts).toHaveLength(0);
  });

  it('discards a stale poll response that lands after a retry', async () => {
    const rev3 = jobEnvelope('partially_ready', {
      revision: 3,
      chunks: [READY_CHUNK, FAILED_CHUNK],
    });
    const rev4 = jobEnvelope('partially_ready', {
      revision: 4,
      chunks: [READY_CHUNK, {...FAILED_CHUNK, status: 'processing'}],
    });
    const resolvers: Array<(value: unknown) => void> = [];
    const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return jsonResponse(rev4);
      return new Promise(resolve => {
        resolvers.push(resolve);
      });
    });
    const probe = await renderProbe(fetchImpl);
    await act(async () => {
      resolvers[0](jsonResponse(rev3));
    });
    expect(generationOf(probe)).toMatchObject({job: {revision: 3}});

    // The scheduled poll round fires while the retry POST is in flight.
    let retryPromise!: Promise<
      Awaited<ReturnType<UseLessonGenerationJobResult['retryPart']>>
    >;
    await act(async () => {
      retryPromise = probe.latest().retryPart({kind: 'chunk', id: 'c1'});
      jest.advanceTimersByTime(500);
    });
    expect(
      fetchImpl.mock.calls.filter(
        ([, i]) => (i as RequestInit)?.method !== 'POST',
      ),
    ).toHaveLength(3);
    await act(async () => {
      await retryPromise;
    });
    expect(generationOf(probe)).toMatchObject({job: {revision: 4}});

    // The stale pre-retry poll resolves late with revision 3.
    const staleResolve = resolvers[1];
    expect(staleResolve).toBeDefined();
    await act(async () => {
      staleResolve?.(jsonResponse(rev3));
    });
    expect(generationOf(probe)).toMatchObject({job: {revision: 4}});
  });
});
