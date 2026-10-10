import {getAppConfig} from '@core/api/appConfig';

import {
  confirmMoment,
  fetchActiveMoments,
  fetchSituations,
  submitMoment,
} from '../momentClient';

jest.mock('@core/api/appConfig', () => ({getAppConfig: jest.fn()}));
jest.mock('@core/api/authenticatedFetch', () => ({
  authenticatedFetch: jest.fn(),
}));

const {authenticatedFetch} = jest.requireMock(
  '@core/api/authenticatedFetch',
) as {
  authenticatedFetch: jest.Mock;
};

const SITUATION = '55555555-5555-4555-8555-555555555501';
const MOMENT = '66666666-6666-4666-8666-666666666601';
const KEY = '77777777-7777-4777-8777-777777777701';

function jsonResponse(status: number, body: unknown): Response {
  return {status, ok: status < 300, json: async () => body} as Response;
}

describe('momentClient', () => {
  beforeEach(() => {
    (getAppConfig as jest.Mock).mockReturnValue({
      apiBaseUrl: 'https://api.test',
    });
    authenticatedFetch.mockReset();
  });

  it('starts a moment with the idempotency key and returns the request id', async () => {
    authenticatedFetch.mockResolvedValue(
      jsonResponse(202, {
        request_id: KEY,
        status: 'success',
        moment_request_id: MOMENT,
      }),
    );

    const result = await submitMoment(
      {intent: 'use', level: 'A1', situation_id: SITUATION},
      KEY,
    );

    expect(result).toEqual({ok: true, value: {moment_request_id: MOMENT}});
    const [url, init] = authenticatedFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/v1/moments');
    expect(init.method).toBe('POST');
    expect(init.headers['idempotency-key']).toBe(KEY);
    expect(JSON.parse(init.body)).toEqual({
      intent: 'use',
      level: 'A1',
      situation_id: SITUATION,
    });
  });

  it('maps a kids-account refusal to an auth-style error with its code', async () => {
    authenticatedFetch.mockResolvedValue(
      jsonResponse(403, {
        status: 'failed',
        error: {code: 'CREATION_NOT_ALLOWED', message: 'no'},
      }),
    );
    const result = await submitMoment(
      {intent: 'use', situation_note: 'tea please'},
      KEY,
    );
    expect(result).toMatchObject({
      ok: false,
      errorCode: 'CREATION_NOT_ALLOWED',
      kind: 'auth-error',
    });
  });

  it('accepts or rejects a situation and reports success without a body', async () => {
    authenticatedFetch.mockResolvedValue(
      jsonResponse(200, {status: 'success', result: 'accepted'}),
    );
    expect(await confirmMoment(MOMENT, true)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(JSON.parse(authenticatedFetch.mock.calls[0][1].body)).toEqual({
      accept: true,
    });
  });

  it('reads the catalogue for a level and rejects a malformed answer', async () => {
    authenticatedFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        situations: [
          {
            id: SITUATION,
            code: 'order_drink',
            title_vi: 'Gọi đồ uống',
            title_en: 'Order a drink',
            level_code: 'A1',
            goals: [],
            interests: [],
          },
        ],
      }),
    );
    const good = await fetchSituations('A1');
    expect(good.ok && good.value[0].code).toBe('order_drink');
    expect(authenticatedFetch.mock.calls[0][0]).toBe(
      'https://api.test/api/v1/situations?level=A1',
    );

    authenticatedFetch.mockResolvedValueOnce(
      jsonResponse(200, {situations: [{id: 'not-a-uuid'}]}),
    );
    expect(await fetchSituations(undefined)).toMatchObject({
      ok: false,
      kind: 'content-error',
    });
  });

  it('lists active moments for the App to resume', async () => {
    authenticatedFetch.mockResolvedValue(
      jsonResponse(200, {
        contract_version: 1,
        requests: [
          {
            id: MOMENT,
            status: 'awaiting_confirmation',
            situation_vi: 'Bạn gọi trà đá.',
            confirm_expires_at: null,
            lesson_id: null,
          },
        ],
      }),
    );
    const result = await fetchActiveMoments();
    expect(authenticatedFetch.mock.calls[0][0]).toBe(
      'https://api.test/api/v1/lesson-creations?kind=moment&active=true',
    );
    expect(result.ok && result.value[0].situation_vi).toBe('Bạn gọi trà đá.');
  });
});
