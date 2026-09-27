import * as AuthSession from '@shared/auth/authSession';
import {
  completeLessonProgress,
  fetchContinueLearning,
  listLessonProgress,
  markVocabularySeen,
  setVocabularyProgress,
  startLessonProgress,
  submitExerciseAttempt,
} from '../learningProgressClient';
import startFixture from './fixtures/start-lesson-response.json';
import completeFixture from './fixtures/complete-lesson-response.json';
import listFixture from './fixtures/list-lesson-progress-response.json';
import attemptFixture from './fixtures/submit-attempt-response.json';
import seenFixture from './fixtures/vocabulary-seen-response.json';
import setProgressFixture from './fixtures/set-vocabulary-progress-response.json';
import continueFixture from './fixtures/continue-learning-response.json';
import continueNullFixture from './fixtures/continue-learning-null-response.json';

const LESSON_ID = '11111111-1111-4111-8111-111111111111';
const EXERCISE_ID = '33333333-3333-4333-8333-333333333333';
const VOCABULARY_ID = '55555555-5555-4555-8555-555555555555';
const BASE_URL = 'http://localhost:3000';

const ACCESS_TOKEN = 'abc123';

const validSession = {
  status: 'valid' as const,
  session: {
    access_token: ACCESS_TOKEN,
    session_id: '1',
    refresh_token: '2',
    access_expires_at: '2050',
    refresh_expires_at: '2050',
  },
  userId: 'user1',
};

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Headers(),
  json: jest.fn().mockResolvedValue(body),
});

const failedBody = (code: string, message = 'failed.') => ({
  request_id: 'req-err',
  status: 'failed',
  error: {code, message},
});

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach(item => collectKeys(item, keys));
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, entry] of Object.entries(value)) {
      keys.push(key);
      collectKeys(entry, keys);
    }
  }
  return keys;
}

const ALL_FIXTURES = [
  startFixture,
  completeFixture,
  listFixture,
  attemptFixture,
  seenFixture,
  setProgressFixture,
  continueFixture,
  continueNullFixture,
];

beforeEach(() => {
  jest.spyOn(AuthSession, 'ensureValidSession').mockResolvedValue(validSession);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('learningProgressClient request contracts', () => {
  it('POSTs start to the exact lesson path with the auth token and no body', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(startFixture));
    const result = await startLessonProgress(LESSON_ID, {fetchImpl});

    expect(result).toEqual({
      ok: true,
      requestId: 'req-start-001',
      progress: startFixture.progress,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/v1/lessons/${LESSON_ID}/start`);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer ' + ACCESS_TOKEN,
    );
    expect(init.body).toBeUndefined();
  });

  it('POSTs complete to the exact lesson path', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse(completeFixture));
    const result = await completeLessonProgress(LESSON_ID, {fetchImpl});

    expect(result).toEqual({
      ok: true,
      requestId: 'req-complete-001',
      progress: completeFixture.progress,
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/v1/lessons/${LESSON_ID}/complete`);
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
  });

  it('GETs the owner lesson-progress list preserving order', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(listFixture));
    const result = await listLessonProgress({fetchImpl});

    expect(result).toEqual({
      ok: true,
      requestId: 'req-list-001',
      items: listFixture.items,
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/v1/me/lesson-progress`);
    expect(init.method).toBe('GET');
    if (result.ok) {
      expect(result.items.map(item => item.lesson_id)).toEqual([
        '11111111-1111-4111-8111-111111111111',
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
      ]);
    }
  });

  it('POSTs the attempt as the { answer } envelope', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(attemptFixture));
    const answer = {selected_option_ids: ['opt-b']};
    const result = await submitExerciseAttempt(EXERCISE_ID, answer, {
      fetchImpl,
    });

    expect(result).toEqual({
      ok: true,
      requestId: 'req-attempt-001',
      result: attemptFixture.result,
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/v1/exercises/${EXERCISE_ID}/attempts`);
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({answer}));
  });

  it('POSTs vocabulary seen with no body', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(seenFixture));
    const result = await markVocabularySeen(VOCABULARY_ID, {fetchImpl});

    expect(result).toEqual({
      ok: true,
      requestId: 'req-seen-001',
      progress: seenFixture.progress,
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/v1/vocabularies/${VOCABULARY_ID}/seen`);
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
  });

  it('PUTs vocabulary status as the { status } envelope', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse(setProgressFixture));
    const result = await setVocabularyProgress(VOCABULARY_ID, 'known', {
      fetchImpl,
    });

    expect(result).toEqual({
      ok: true,
      requestId: 'req-vocab-progress-001',
      progress: setProgressFixture.progress,
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/v1/vocabularies/${VOCABULARY_ID}/progress`);
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(JSON.stringify({status: 'known'}));
  });

  it('GETs continue-learning returning the active progress', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse(continueFixture));
    const result = await fetchContinueLearning({fetchImpl});

    expect(result).toEqual({
      ok: true,
      requestId: 'req-continue-001',
      progress: continueFixture.progress,
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/v1/me/continue-learning`);
    expect(init.method).toBe('GET');
  });

  it('maps a null continue-learning to progress null', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse(continueNullFixture));
    await expect(fetchContinueLearning({fetchImpl})).resolves.toEqual({
      ok: true,
      requestId: 'req-continue-002',
      progress: null,
    });
  });

  it('URL-encodes path identifiers', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(startFixture));
    await startLessonProgress('lesson id/with?chars', {fetchImpl});
    const [url] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `${BASE_URL}/v1/lessons/${encodeURIComponent(
        'lesson id/with?chars',
      )}/start`,
    );
  });
});

describe('learningClient auth, cancellation, and transport', () => {
  it('retries once with the refreshed token after a 401', async () => {
    const ensureSpy = jest.mocked(AuthSession.ensureValidSession);
    ensureSpy.mockReset();
    ensureSpy.mockImplementation(async (input?: {forceRefresh?: boolean}) =>
      input?.forceRefresh
        ? {
            ...validSession,
            session: {...validSession.session, access_token: 'refreshed-token'},
          }
        : validSession,
    );
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(failedBody('SESSION_EXPIRED'), 401))
      .mockResolvedValueOnce(jsonResponse(startFixture));

    const result = await startLessonProgress(LESSON_ID, {fetchImpl});

    expect(result).toEqual({
      ok: true,
      requestId: 'req-start-001',
      progress: startFixture.progress,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [, retryInit] = fetchImpl.mock.calls[1] as [string, RequestInit];
    expect((retryInit.headers as Record<string, string>).Authorization).toBe(
      'Bearer refreshed-token',
    );
  });

  it('maps a persistent 401 to auth-error without retry', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse(failedBody('SESSION_EXPIRED'), 401));
    const result = await listLessonProgress({fetchImpl});

    expect(result).toMatchObject({
      ok: false,
      kind: 'auth-error',
      errorCode: 'SESSION_EXPIRED',
      retryable: false,
      status: 401,
    });
  });

  it('returns cancelled without fetching when the signal is already aborted', async () => {
    const fetchImpl = jest.fn();
    const controller = new AbortController();
    controller.abort();
    const result = await startLessonProgress(LESSON_ID, {
      fetchImpl,
      signal: controller.signal,
    });

    expect(result).toMatchObject({
      ok: false,
      errorCode: 'CANCELLED',
      cancelled: true,
      retryable: false,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps an AbortError rejection to cancelled', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    const fetchImpl = jest.fn().mockRejectedValue(abortError);
    const result = await fetchContinueLearning({fetchImpl});

    expect(result).toMatchObject({
      ok: false,
      errorCode: 'CANCELLED',
      cancelled: true,
    });
  });

  it('maps a transport rejection to a retryable NETWORK_ERROR', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('network down'));
    const result = await submitExerciseAttempt(
      EXERCISE_ID,
      {x: 1},
      {fetchImpl},
    );

    expect(result).toEqual({
      ok: false,
      kind: 'network-error',
      errorCode: 'NETWORK_ERROR',
      message: 'Network connection lost.',
      retryable: true,
    });
  });
});

describe('learningClient error categories', () => {
  it('maps 404 LESSON_NOT_FOUND to not-found without retry', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse(failedBody('LESSON_NOT_FOUND'), 404));
    await expect(
      startLessonProgress(LESSON_ID, {fetchImpl}),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'not-found',
      errorCode: 'LESSON_NOT_FOUND',
      retryable: false,
      status: 404,
    });
  });

  it('maps 404 EXERCISE_NOT_FOUND to not-found without retry', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse(failedBody('EXERCISE_NOT_FOUND'), 404));
    await expect(
      submitExerciseAttempt(
        EXERCISE_ID,
        {selected_option_ids: ['opt-a']},
        {fetchImpl},
      ),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'not-found',
      errorCode: 'EXERCISE_NOT_FOUND',
      retryable: false,
      status: 404,
    });
  });

  it('maps 404 VOCABULARY_NOT_FOUND to not-found without retry', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse(failedBody('VOCABULARY_NOT_FOUND'), 404));
    await expect(
      markVocabularySeen(VOCABULARY_ID, {fetchImpl}),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'not-found',
      errorCode: 'VOCABULARY_NOT_FOUND',
      retryable: false,
      status: 404,
    });
  });

  it('maps 409 LESSON_NOT_STARTED to protocol-error', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(failedBody('LESSON_NOT_STARTED', 'Start first.'), 409),
      );
    await expect(
      completeLessonProgress(LESSON_ID, {fetchImpl}),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'protocol-error',
      errorCode: 'LESSON_NOT_STARTED',
      retryable: false,
      status: 409,
    });
  });

  it('maps 409 VOCABULARY_NOT_SEEN to protocol-error', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(failedBody('VOCABULARY_NOT_SEEN', 'See first.'), 409),
      );
    await expect(
      setVocabularyProgress(VOCABULARY_ID, 'known', {fetchImpl}),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'protocol-error',
      errorCode: 'VOCABULARY_NOT_SEEN',
      retryable: false,
    });
  });

  it('maps 409 MERGE_IN_PROGRESS to retryable merge-in-progress', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(failedBody('MERGE_IN_PROGRESS', 'Merging.'), 409),
      );
    await expect(
      startLessonProgress(LESSON_ID, {fetchImpl}),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'merge-in-progress',
      errorCode: 'MERGE_IN_PROGRESS',
      retryable: true,
      status: 409,
    });
  });

  it('maps 422 EXERCISE_ANSWER_INVALID to invalid-answer', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(failedBody('EXERCISE_ANSWER_INVALID', 'Bad shape.'), 422),
      );
    await expect(
      submitExerciseAttempt(EXERCISE_ID, {wrong: 'shape'}, {fetchImpl}),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'invalid-answer',
      errorCode: 'EXERCISE_ANSWER_INVALID',
      retryable: false,
      status: 422,
    });
  });

  it('maps 400 validation failures to protocol-error', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(
          failedBody('VALIDATION_EXERCISE_ANSWER', 'No answer.'),
          400,
        ),
      );
    await expect(
      submitExerciseAttempt(EXERCISE_ID, {}, {fetchImpl}),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'protocol-error',
      errorCode: 'VALIDATION_EXERCISE_ANSWER',
      retryable: false,
    });
  });

  it('rejects an invalid local status without fetching', async () => {
    const fetchImpl = jest.fn();
    const result = await setVocabularyProgress(
      VOCABULARY_ID,
      'bogus' as 'known',
      {fetchImpl},
    );
    expect(result).toMatchObject({
      ok: false,
      kind: 'protocol-error',
      errorCode: 'VALIDATION_VOCABULARY_STATUS',
      retryable: false,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps 500 EXERCISE_EVALUATION_UNAVAILABLE to retryable server-error', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(
          failedBody('EXERCISE_EVALUATION_UNAVAILABLE', 'Unavailable.'),
          500,
        ),
      );
    await expect(
      submitExerciseAttempt(
        EXERCISE_ID,
        {selected_option_ids: ['opt-a']},
        {fetchImpl},
      ),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'server-error',
      errorCode: 'EXERCISE_EVALUATION_UNAVAILABLE',
      retryable: true,
      status: 500,
    });
  });

  it('maps an unreadable error body by status', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers(),
      json: jest.fn().mockRejectedValue(new Error('bad json')),
    });
    await expect(listLessonProgress({fetchImpl})).resolves.toMatchObject({
      ok: false,
      kind: 'server-error',
      errorCode: 'HTTP_500',
      retryable: true,
    });
  });
});

describe('learningClient strict response parsing', () => {
  it('rejects a success body with invalid JSON', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: jest.fn().mockRejectedValue(new Error('bad json')),
    });
    await expect(
      startLessonProgress(LESSON_ID, {fetchImpl}),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'protocol-error',
      errorCode: 'INVALID_RESPONSE',
      retryable: false,
    });
  });

  it('rejects a success envelope missing request_id', async () => {
    const body = {...startFixture, request_id: undefined};
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(body));
    await expect(
      startLessonProgress(LESSON_ID, {fetchImpl}),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'protocol-error',
      errorCode: 'INVALID_RESPONSE',
    });
  });

  it('rejects a lesson progress with an unknown status', async () => {
    const body = {
      ...startFixture,
      progress: {...startFixture.progress, status: 'half_done'},
    };
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(body));
    await expect(
      startLessonProgress(LESSON_ID, {fetchImpl}),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'protocol-error',
      errorCode: 'INVALID_RESPONSE',
    });
  });

  it('rejects an attempt result missing is_correct instead of guessing', async () => {
    const result = {...attemptFixture.result, is_correct: undefined};
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse({...attemptFixture, result}));
    await expect(
      submitExerciseAttempt(
        EXERCISE_ID,
        {selected_option_ids: ['opt-a']},
        {fetchImpl},
      ),
    ).resolves.toMatchObject({
      ok: false,
      kind: 'protocol-error',
      errorCode: 'INVALID_RESPONSE',
    });
  });

  it('rejects a non-null continue-learning with the wrong shape', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({request_id: 'r', status: 'success', progress: 42}),
      );
    await expect(fetchContinueLearning({fetchImpl})).resolves.toMatchObject({
      ok: false,
      kind: 'protocol-error',
      errorCode: 'INVALID_RESPONSE',
    });
  });
});

describe('learningClient secret hygiene', () => {
  it('keeps user_id inputs and answer_key outputs out of every fixture', () => {
    for (const fixture of ALL_FIXTURES) {
      const keys = collectKeys(fixture);
      expect(keys).not.toContain('user_id');
      expect(keys).not.toContain('answer_key');
      expect(keys).not.toContain('answerKey');
    }
  });

  it('never sends user_id in request bodies', async () => {
    const bodies: string[] = [];
    const fetchImpl = jest.fn().mockImplementation((_url, init) => {
      if (typeof init?.body === 'string') bodies.push(init.body);
      return Promise.resolve(jsonResponse(attemptFixture));
    });
    await submitExerciseAttempt(
      EXERCISE_ID,
      {selected_option_ids: ['opt-a']},
      {fetchImpl},
    );
    const putImpl = jest.fn().mockImplementation((_url, init) => {
      if (typeof init?.body === 'string') bodies.push(init.body);
      return Promise.resolve(jsonResponse(setProgressFixture));
    });
    await setVocabularyProgress(VOCABULARY_ID, 'learning', {
      fetchImpl: putImpl,
    });

    expect(bodies).toHaveLength(2);
    for (const body of bodies) {
      expect(body).not.toContain('user_id');
      expect(body).not.toContain('answer_key');
    }
  });
});
