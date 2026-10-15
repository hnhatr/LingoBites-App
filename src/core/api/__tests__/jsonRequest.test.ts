import {z} from 'zod';

import {requestJson} from '../jsonRequest';

jest.mock('../appConfig', () => ({
  getAppConfig: () => ({apiBaseUrl: 'https://api.test'}),
}));

jest.mock('../authenticatedFetch', () => ({
  authenticatedFetch: (
    url: string,
    init: RequestInit,
    fetchImpl: typeof fetch,
  ) => fetchImpl(url, init),
}));

const Schema = z.object({value: z.number()});

function response(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {get: (name: string) => headers[name] ?? null},
    json: () =>
      body === undefined
        ? Promise.reject(new Error('no body'))
        : Promise.resolve(body),
  } as unknown as Response;
}

describe('requestJson failures', () => {
  it("keeps the Server's error code and request id", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      response(409, {
        request_id: 'req-1',
        status: 'failed',
        error: {code: 'SITUATION_NOT_ENABLED', message: 'x'},
      }),
    );
    const result = await requestJson(
      Schema,
      '/v1/combo/sets',
      {method: 'POST'},
      {fetchImpl},
    );
    expect(result).toEqual({
      ok: false,
      kind: 'client-error',
      message: 'The request failed (409).',
      code: 'SITUATION_NOT_ENABLED',
      requestId: 'req-1',
    });
  });

  it('keeps the code of a 404 too', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        response(404, {request_id: 'req-2', error: {code: 'ITEM_NOT_FOUND'}}),
      );
    const result = await requestJson(Schema, '/x', {}, {fetchImpl});
    expect(result).toMatchObject({
      ok: false,
      kind: 'not-found',
      code: 'ITEM_NOT_FOUND',
      requestId: 'req-2',
    });
  });

  it('falls back to the X-Request-Id header when the body is not JSON', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        response(502, undefined, {'X-Request-Id': 'req-header'}),
      );
    const result = await requestJson(Schema, '/x', {}, {fetchImpl});
    expect(result).toEqual({
      ok: false,
      kind: 'server-error',
      message: 'The request failed (502).',
      requestId: 'req-header',
    });
  });

  it('carries the request id on a body that does not match the schema', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        response(200, {value: 'nope'}, {'X-Request-Id': 'req-3'}),
      );
    const result = await requestJson(Schema, '/x', {}, {fetchImpl});
    expect(result).toMatchObject({
      ok: false,
      kind: 'contract-mismatch',
      requestId: 'req-3',
    });
  });

  it('still returns the parsed body on success', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200, {value: 1}));
    const result = await requestJson(Schema, '/x', {}, {fetchImpl});
    expect(result).toEqual({ok: true, value: {value: 1}});
  });
});
