import * as AuthSession from '@shared/auth/authSession';
import {
  createLessonGenerationJob,
  fetchLessonGenerationJob,
  isLessonGenerationTerminal,
  LessonGenerationJobEnvelopeSchema,
  LessonGenerationJobSchema,
  listRetryableJobParts,
  retryLessonJobPart,
} from '../lessonJobClient';
import jobStatusFixture from './fixtures/valid-lesson-job-status.json';

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

function jobEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    request_id: 'req-job',
    status: 'success',
    job: {
      id: JOB_ID,
      status: 'skeleton_ready',
      revision: 1,
      pollAfterMs: 1000,
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

describe('createLessonGenerationJob', () => {
  beforeEach(() => {
    jest
      .spyOn(AuthSession, 'ensureValidSession')
      .mockResolvedValue(validSession);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('posts the job-only create path with idempotency key and text body', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(jobEnvelope()));
    const result = await createLessonGenerationJob(
      {confirmedText: 'Hello world', idempotencyKey: 'key-1'},
      {fetchImpl},
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.job.id).toBe(JOB_ID);
    expect(result.job.lessonId).toBeNull();
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/api/v1/lesson-jobs');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe(
      'key-1',
    );
    expect(JSON.parse(init.body as string)).toMatchObject({
      confirmed_text: 'Hello world',
    });
  });

  it('mints an idempotency key when the caller passes none', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(jobEnvelope()));
    const result = await createLessonGenerationJob(
      {confirmedText: 'Hello world'},
      {fetchImpl},
    );
    expect(result.ok).toBe(true);
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toMatch(
      /.+/,
    );
  });

  it('rejects empty text locally without a network call', async () => {
    const fetchImpl = jest.fn();
    await expect(
      createLessonGenerationJob({confirmedText: '   '}, {fetchImpl}),
    ).resolves.toMatchObject({ok: false, kind: 'invalid-input'});
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps 409 to non-retryable invalid-input', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(
        {
          request_id: 'r1',
          status: 'failed',
          error: {code: 'IDEMPOTENCY_CONFLICT', message: 'Reuse.'},
        },
        409,
      ),
    );
    await expect(
      createLessonGenerationJob({confirmedText: 'Hi'}, {fetchImpl}),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'invalid-input',
      errorCode: 'IDEMPOTENCY_CONFLICT',
      retryable: false,
    });
  });
});

describe('fetchLessonGenerationJob', () => {
  beforeEach(() => {
    jest
      .spyOn(AuthSession, 'ensureValidSession')
      .mockResolvedValue(validSession);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('polls the job path and returns the materialized lesson id', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(
          jobEnvelope({status: 'ready', revision: 4, lessonId: JOB_ID}),
        ),
      );
    const result = await fetchLessonGenerationJob(JOB_ID, {fetchImpl});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.job.status).toBe('ready');
    expect(result.job.lessonId).toBe(JOB_ID);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`http://localhost:3000/api/v1/lesson-jobs/${JOB_ID}`);
    expect(init.method).toBe('GET');
  });

  it('maps a foreign or missing job to not-found', async () => {
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
    await expect(
      fetchLessonGenerationJob(JOB_ID, {fetchImpl}),
    ).resolves.toMatchObject({ok: false, kind: 'not-found'});
  });

  it('maps an invalid envelope to content-error without content', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse({job: {id: JOB_ID, status: 'ready'}}));
    const result = await fetchLessonGenerationJob(JOB_ID, {fetchImpl});
    expect(result).toMatchObject({ok: false, kind: 'content-error'});
  });
});

describe('canonical job/part contract (TASK-002 fixture)', () => {
  it('parses the Server-owned fixture without transformation', () => {
    const parsed =
      LessonGenerationJobEnvelopeSchema.safeParse(jobStatusFixture);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.job.status).toBe('partially_ready');
    expect(parsed.data.job.chunks).toHaveLength(2);
    expect(parsed.data.job.units).toHaveLength(4);
  });

  it('rejects a part snapshot with an unknown status', () => {
    const parsed = LessonGenerationJobEnvelopeSchema.safeParse({
      ...jobStatusFixture,
      job: {
        ...(jobStatusFixture.job as Record<string, unknown>),
        chunks: [
          {
            id: 'c1',
            status: 'retrying',
            attempts: 2,
            errorCode: null,
            retryable: true,
            revision: 2,
          },
        ],
      },
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects a job envelope missing chunks/units', () => {
    const {
      chunks: _chunks,
      units: _units,
      ...job
    } = jobEnvelope().job as Record<string, unknown> & {
      chunks: unknown;
      units: unknown;
    };
    expect(
      LessonGenerationJobEnvelopeSchema.safeParse({
        request_id: 'req-job',
        status: 'success',
        job,
      }).success,
    ).toBe(false);
    expect(_chunks).toBeDefined();
    expect(_units).toBeDefined();
  });

  it('lists only failed retryable parts', () => {
    const parsed = LessonGenerationJobEnvelopeSchema.parse(jobStatusFixture);
    const parts = listRetryableJobParts(parsed.job);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({kind: 'chunk', chunk: {id: 'c1'}});
  });
});

describe('retryLessonJobPart', () => {
  beforeEach(() => {
    jest
      .spyOn(AuthSession, 'ensureValidSession')
      .mockResolvedValue(validSession);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('posts the chunk retry path with key, revision and request id', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(jobEnvelope()));
    const result = await retryLessonJobPart(
      {
        jobId: JOB_ID,
        target: {kind: 'chunk', id: 'c1'},
        expectedRevision: 3,
        idempotencyKey: 'retry-key-1',
      },
      {fetchImpl},
    );

    expect(result.ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `http://localhost:3000/api/v1/lesson-jobs/${JOB_ID}/chunks/c1/retry`,
    );
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe(
      'retry-key-1',
    );
    expect(JSON.parse(init.body as string)).toMatchObject({
      expected_revision: 3,
    });
    expect(typeof JSON.parse(init.body as string).request_id).toBe('string');
  });

  it('posts the unit retry path for the selected target only', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(jobEnvelope()));
    await retryLessonJobPart(
      {
        jobId: JOB_ID,
        target: {kind: 'unit', key: 'grammar'},
        expectedRevision: 3,
        idempotencyKey: 'retry-key-2',
      },
      {fetchImpl},
    );

    const [url] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `http://localhost:3000/api/v1/lesson-jobs/${JOB_ID}/units/grammar/retry`,
    );
    expect(url).not.toContain('/chunks/');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('accepts a 202 queued retry as success', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse(jobEnvelope(), 202));
    const result = await retryLessonJobPart(
      {
        jobId: JOB_ID,
        target: {kind: 'unit', key: 'vocabulary'},
        expectedRevision: 3,
      },
      {fetchImpl},
    );
    expect(result.ok).toBe(true);
  });

  it.each([
    'JOB_REVISION_CONFLICT',
    'RETRY_NOT_ALLOWED',
    'IDEMPOTENCY_CONFLICT',
  ])('maps 409 %s to a conflict result', async code => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(
        {
          request_id: 'r1',
          status: 'failed',
          error: {code, message: 'Conflict.'},
        },
        409,
      ),
    );
    await expect(
      retryLessonJobPart(
        {
          jobId: JOB_ID,
          target: {kind: 'chunk', id: 'c1'},
          expectedRevision: 2,
        },
        {fetchImpl},
      ),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'conflict',
      errorCode: code,
      retryable: false,
    });
  });

  it('maps a foreign job or target to not-found', async () => {
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
    await expect(
      retryLessonJobPart(
        {
          jobId: JOB_ID,
          target: {kind: 'unit', key: 'nope'},
          expectedRevision: 3,
        },
        {fetchImpl},
      ),
    ).resolves.toMatchObject({ok: false, kind: 'not-found'});
  });
});

describe('isLessonGenerationTerminal', () => {
  it('treats ready, ready_with_warnings, and failed as terminal', () => {
    const base = {
      id: JOB_ID,
      revision: 2,
      pollAfterMs: 1000,
      lessonId: JOB_ID,
      chunks: [],
      units: [],
      error: null,
      warnings: [],
    };
    expect(
      isLessonGenerationTerminal(
        LessonGenerationJobSchema.parse({...base, status: 'ready'}),
      ),
    ).toBe(true);
    expect(
      isLessonGenerationTerminal(
        LessonGenerationJobSchema.parse({
          ...base,
          status: 'ready_with_warnings',
        }),
      ),
    ).toBe(true);
    expect(
      isLessonGenerationTerminal(
        LessonGenerationJobSchema.parse({
          ...base,
          status: 'failed',
          lessonId: null,
          error: {code: 'X', message: 'Y'},
        }),
      ),
    ).toBe(true);
    expect(
      isLessonGenerationTerminal(
        LessonGenerationJobSchema.parse({...base, status: 'partially_ready'}),
      ),
    ).toBe(false);
  });
});
