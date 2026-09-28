import * as AuthSession from '@shared/auth/authSession';
import {
  checkCurriculumLessonExercise,
  fetchCurriculumLesson,
} from '../curriculumLessonClient';
import aggregateResponseFixture from './fixtures/valid-lesson-aggregate-response.json';
import checkResponseFixture from './fixtures/valid-exercise-check-response.json';
import fullAggregateFixture from './fixtures/valid-learner-lesson-aggregate.json';

const LESSON_ID = '00000000-0000-4000-8000-000000000010';
const EXERCISE_ID = '00000000-0000-4000-8000-000000000040';

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

const fullAggregateResponse = {
  request_id: 'req-full',
  status: 'success',
  lesson: fullAggregateFixture,
};

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Headers(),
  json: jest.fn().mockResolvedValue(body),
});

describe('fetchCurriculumLesson', () => {
  beforeEach(() => {
    jest
      .spyOn(AuthSession, 'ensureValidSession')
      .mockResolvedValue(validSession);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fetches the exact aggregate path with the bearer token', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse(fullAggregateResponse));
    const result = await fetchCurriculumLesson(LESSON_ID, {fetchImpl});

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`http://localhost:3000/api/v1/lessons/${LESSON_ID}`);
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).Accept).toBe(
      'application/json',
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-token',
    );
  });

  it('returns all five block variants from the canonical fixture', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse(fullAggregateResponse));
    const result = await fetchCurriculumLesson(LESSON_ID, {fetchImpl});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.requestId).toBe('req-full');
    expect(result.lesson.blocks.map(block => block.type)).toEqual([
      'text',
      'example',
      'vocabulary',
      'media',
      'exercise',
    ]);
  });

  it('accepts the minimal canonical aggregate envelope', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse(aggregateResponseFixture));
    const result = await fetchCurriculumLesson(LESSON_ID, {fetchImpl});
    expect(result).toMatchObject({ok: true});
  });

  it('maps 404 LESSON_NOT_FOUND to not-found without retry', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(
        {
          request_id: 'r1',
          status: 'failed',
          error: {code: 'LESSON_NOT_FOUND', message: 'No such lesson.'},
        },
        404,
      ),
    );
    await expect(
      fetchCurriculumLesson(LESSON_ID, {fetchImpl}),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'not-found',
      errorCode: 'LESSON_NOT_FOUND',
      retryable: false,
      status: 404,
    });
  });

  it('maps LESSON_CONTENT_INVALID to content-error', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(
        {
          request_id: 'r1',
          status: 'failed',
          error: {code: 'LESSON_CONTENT_INVALID', message: 'Broken media.'},
        },
        422,
      ),
    );
    await expect(
      fetchCurriculumLesson(LESSON_ID, {fetchImpl}),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'content-error',
      errorCode: 'LESSON_CONTENT_INVALID',
      retryable: false,
    });
  });

  it('maps 401 to auth-error', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(
        {
          request_id: 'r1',
          status: 'failed',
          error: {code: 'UNAUTHENTICATED', message: 'Sign in again.'},
        },
        401,
      ),
    );
    await expect(
      fetchCurriculumLesson(LESSON_ID, {fetchImpl}),
    ).resolves.toMatchObject({ok: false, kind: 'auth-error'});
  });

  it('maps 500 to retryable server-error', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(
        {
          request_id: 'r1',
          status: 'failed',
          error: {code: 'INTERNAL', message: 'Boom.'},
        },
        500,
      ),
    );
    await expect(
      fetchCurriculumLesson(LESSON_ID, {fetchImpl}),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'server-error',
      retryable: true,
      status: 500,
    });
  });

  it('maps a 200 with a malformed body to content-error', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({nope: true}));
    await expect(
      fetchCurriculumLesson(LESSON_ID, {fetchImpl}),
    ).resolves.toMatchObject({ok: false, kind: 'content-error'});
  });

  it('maps a transport throw to retryable network-error', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('down'));
    await expect(
      fetchCurriculumLesson(LESSON_ID, {fetchImpl}),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'network-error',
      errorCode: 'NETWORK_ERROR',
      retryable: true,
    });
  });

  it('does not fetch when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = jest.fn();
    await expect(
      fetchCurriculumLesson(LESSON_ID, {fetchImpl, signal: controller.signal}),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'network-error',
      cancelled: true,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps an in-flight abort to cancelled', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    const fetchImpl = jest.fn().mockRejectedValue(abortError);
    await expect(
      fetchCurriculumLesson(LESSON_ID, {fetchImpl}),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'network-error',
      errorCode: 'CANCELLED',
      cancelled: true,
    });
  });

  it('keeps unknown blocks as placeholders instead of failing', async () => {
    const body = {
      request_id: 'req-1',
      status: 'success',
      lesson: {
        ...fullAggregateFixture,
        blocks: [
          ...fullAggregateFixture.blocks,
          {id: 'x', type: 'future', position: 9},
        ],
      },
    };
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(body));
    const result = await fetchCurriculumLesson(LESSON_ID, {fetchImpl});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lesson.blocks).toHaveLength(6);
    expect(result.lesson.blocks[5]?.type).toBe('unsupported');
  });
});

describe('checkCurriculumLessonExercise', () => {
  beforeEach(() => {
    jest
      .spyOn(AuthSession, 'ensureValidSession')
      .mockResolvedValue(validSession);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('posts the exact check path and strict answer body', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse(checkResponseFixture));
    const result = await checkCurriculumLessonExercise(
      EXERCISE_ID,
      {optionId: 'a'},
      {fetchImpl},
    );

    expect(result).toMatchObject({ok: true, correct: true});
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `http://localhost:3000/api/v1/exercises/${EXERCISE_ID}/check`,
    );
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    );
    expect(init.body).toBe(JSON.stringify({answer: {optionId: 'a'}}));
  });

  it('maps EXERCISE_NOT_FOUND to not-found', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(
        {
          request_id: 'r1',
          status: 'failed',
          error: {code: 'EXERCISE_NOT_FOUND', message: 'Gone.'},
        },
        404,
      ),
    );
    await expect(
      checkCurriculumLessonExercise(EXERCISE_ID, {optionId: 'a'}, {fetchImpl}),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'not-found',
      errorCode: 'EXERCISE_NOT_FOUND',
    });
  });

  it('maps INVALID_EXERCISE_ANSWER to invalid-answer', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(
        {
          request_id: 'r1',
          status: 'failed',
          error: {code: 'INVALID_EXERCISE_ANSWER', message: 'Bad option.'},
        },
        422,
      ),
    );
    await expect(
      checkCurriculumLessonExercise(
        EXERCISE_ID,
        {optionId: 'zzz'},
        {fetchImpl},
      ),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'invalid-answer',
      errorCode: 'INVALID_EXERCISE_ANSWER',
      retryable: false,
    });
  });

  it('posts the text answer variant for fill-blank/translation', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse(checkResponseFixture));
    const result = await checkCurriculumLessonExercise(
      EXERCISE_ID,
      {text: 'like'},
      {fetchImpl},
    );

    expect(result).toMatchObject({ok: true, correct: true});
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({answer: {text: 'like'}}));
  });

  it('rejects an empty answer locally without a network call', async () => {
    const fetchImpl = jest.fn();
    await expect(
      checkCurriculumLessonExercise(EXERCISE_ID, {optionId: '  '}, {fetchImpl}),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'invalid-answer',
      errorCode: 'INVALID_EXERCISE_ANSWER',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects blank text locally without a network call', async () => {
    const fetchImpl = jest.fn();
    await expect(
      checkCurriculumLessonExercise(EXERCISE_ID, {text: '   '}, {fetchImpl}),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'invalid-answer',
      errorCode: 'INVALID_EXERCISE_ANSWER',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps a transport throw to retryable network-error', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('down'));
    await expect(
      checkCurriculumLessonExercise(EXERCISE_ID, {optionId: 'a'}, {fetchImpl}),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'network-error',
      retryable: true,
    });
  });

  it('maps a 500 to retryable server-error', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(
        {
          request_id: 'r1',
          status: 'failed',
          error: {code: 'INTERNAL', message: 'Boom.'},
        },
        500,
      ),
    );
    await expect(
      checkCurriculumLessonExercise(EXERCISE_ID, {optionId: 'a'}, {fetchImpl}),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'server-error',
      retryable: true,
    });
  });
});
