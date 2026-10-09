import {getAppConfig} from '@core/api/appConfig';

import {
  fetchActiveComposes,
  fetchComposeCapability,
  fetchComposeQuota,
  submitCompose,
} from '../composeClient';

jest.mock('@core/api/appConfig', () => ({
  getAppConfig: jest.fn(),
}));

jest.mock('@core/api/authenticatedFetch', () => ({
  authenticatedFetch: jest.fn(),
}));

const {authenticatedFetch} = jest.requireMock(
  '@core/api/authenticatedFetch',
) as {authenticatedFetch: jest.Mock};

const LESSON = '11111111-1111-4111-8111-111111111111';
const S1 = '22222222-2222-4222-8222-222222222201';
const S2 = '22222222-2222-4222-8222-222222222202';
const REQUEST = '33333333-3333-4333-8333-333333333301';
const KEY = '44444444-4444-4444-8444-444444444401';

function jsonResponse(status: number, body: unknown): Response {
  return {status, ok: status < 300, json: async () => body} as Response;
}

const progress = {
  stage: 'writing',
  stage_started_at: null,
  elapsed_ms: 3000,
  expected_ms: 25000,
  quota_charged: false,
  reason_vi: null,
  suggestion_vi: null,
  dropped_sentence_ids: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  (getAppConfig as jest.Mock).mockReturnValue({
    apiBaseUrl: 'https://api.example',
  });
});

describe('compose client (S4.3)', () => {
  it('posts the picked sentences with the idempotency key', async () => {
    authenticatedFetch.mockResolvedValue(
      jsonResponse(202, {
        contract_version: 1,
        request: {id: REQUEST, status: 'queued'},
      }),
    );
    const result = await submitCompose(LESSON, [S1, S2], KEY);
    expect(result).toEqual({
      ok: true,
      value: {kind: 'queued', requestId: REQUEST},
    });
    const [url, init] = authenticatedFetch.mock.calls[0];
    expect(url).toBe(`https://api.example/api/v1/lessons/${LESSON}/compose`);
    expect(init.method).toBe('POST');
    expect(init.headers['Idempotency-Key']).toBe(KEY);
    expect(JSON.parse(init.body)).toEqual({sentence_ids: [S1, S2]});
  });

  it('answers a cache hit with the lesson already composed', async () => {
    authenticatedFetch.mockResolvedValue(
      jsonResponse(200, {contract_version: 1, lesson_id: LESSON, cached: true}),
    );
    expect(await submitCompose(LESSON, [S1, S2], KEY)).toEqual({
      ok: true,
      value: {kind: 'cached', lessonId: LESSON},
    });
  });

  it('keeps the refusal code and details (daily limit)', async () => {
    authenticatedFetch.mockResolvedValue(
      jsonResponse(429, {
        request_id: 'r',
        status: 'failed',
        error: {code: 'COMPOSE_LIMIT_REACHED', message: 'limit'},
        details: {limit: 1, used: 1, resets_at: '2026-10-09T17:00:00.000Z'},
      }),
    );
    const result = await submitCompose(LESSON, [S1, S2], KEY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('COMPOSE_LIMIT_REACHED');
      expect(result.details).toEqual({
        limit: 1,
        used: 1,
        resets_at: '2026-10-09T17:00:00.000Z',
      });
    }
  });

  it('reads the quota and the running composes', async () => {
    authenticatedFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        contract_version: 1,
        quota: {
          limit: 2,
          used: 1,
          remaining: 1,
          resets_at: '2026-10-09T17:00:00.000Z',
        },
      }),
    );
    const quota = await fetchComposeQuota();
    expect(quota.ok && quota.value.remaining).toBe(1);

    authenticatedFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        contract_version: 1,
        requests: [
          {
            id: REQUEST,
            status: 'processing',
            source_lesson_id: LESSON,
            source_lesson_title: 'Ở quán cà phê',
            sentence_ids: [S1, S2],
            compose: progress,
          },
        ],
      }),
    );
    const active = await fetchActiveComposes();
    expect(active.ok && active.value[0]?.source_lesson_title).toBe(
      'Ở quán cà phê',
    );
    expect(authenticatedFetch.mock.calls[1][0]).toBe(
      'https://api.example/api/v1/lesson-creations?kind=compose&active=true',
    );
  });

  it('reads the capability fail-closed', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          capabilities: {
            youtube: {enabled: true},
            lessons: {contract_version: 1, compose: {enabled: true}},
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          capabilities: {
            youtube: {enabled: true},
            lessons: {contract_version: 1},
          },
        }),
      )
      .mockRejectedValueOnce(new Error('offline'));
    expect(await fetchComposeCapability({fetchImpl})).toBe(true);
    expect(await fetchComposeCapability({fetchImpl})).toBe(false);
    expect(await fetchComposeCapability({fetchImpl})).toBe(false);
  });
});
