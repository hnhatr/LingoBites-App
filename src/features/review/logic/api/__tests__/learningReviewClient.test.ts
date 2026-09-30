import * as AuthSession from '@core/auth/authSession';

import {fetchReview} from '../learningReviewClient';
import reviewFixture from './fixtures/review-response.json';

const BASE_URL = 'http://localhost:3000';

const validSession = {
  status: 'valid' as const,
  session: {
    access_token: 'abc123',
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

beforeEach(() => {
  jest.spyOn(AuthSession, 'ensureValidSession').mockResolvedValue(validSession);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('learningReviewClient', () => {
  it('GETs review returning the composite exercises/vocabularies shape', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(reviewFixture));
    const result = await fetchReview({fetchImpl});

    expect(result).toEqual({
      ok: true,
      requestId: 'req-review-001',
      exercises: reviewFixture.exercises,
      vocabularies: reviewFixture.vocabularies,
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/v1/me/review`);
    expect(init.method).toBe('GET');
  });

  it('returns cancelled without fetching when the signal is already aborted', async () => {
    const fetchImpl = jest.fn();
    const controller = new AbortController();
    controller.abort();
    const result = await fetchReview({fetchImpl, signal: controller.signal});

    expect(result).toMatchObject({
      ok: false,
      errorCode: 'CANCELLED',
      cancelled: true,
      retryable: false,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps 503 database-unavailable to retryable server-error', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(failedBody('DATABASE_UNAVAILABLE', 'Down.'), 503),
      );
    await expect(fetchReview({fetchImpl})).resolves.toMatchObject({
      ok: false,
      kind: 'server-error',
      retryable: true,
      status: 503,
    });
  });

  it('fails closed when a review exercise leaks answer_key', async () => {
    const body = {
      ...reviewFixture,
      exercises: reviewFixture.exercises.map(entry => ({
        ...entry,
        exercise: {...entry.exercise, answer_key: {options: ['opt-b']}},
      })),
    };
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(body));
    await expect(fetchReview({fetchImpl})).resolves.toMatchObject({
      ok: false,
      kind: 'protocol-error',
      errorCode: 'INVALID_RESPONSE',
    });
  });
});
