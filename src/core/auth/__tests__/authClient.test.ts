import {createAuthClient} from '../authClient';
import type {AuthSession, AuthUser} from '../authTypes';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const user: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111',
  public_code: 'LB-AB12CD34',
  display_name: 'An',
  phone_e164: null,
  status: 'active',
  created_at: '2026-09-14T00:00:00.000Z',
  updated_at: '2026-09-14T00:00:00.000Z',
};

const session: AuthSession = {
  session_id: '22222222-2222-4222-8222-222222222222',
  access_token: 'lb_at_access',
  refresh_token: 'lb_rt_refresh',
  access_expires_at: '2026-09-14T01:00:00.000Z',
  refresh_expires_at: '2026-09-21T00:00:00.000Z',
};

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('authClient bootstrap (SETE-303 / T6)', () => {
  const client = () =>
    createAuthClient({fetchImpl: mockFetch, baseUrl: 'http://test'});

  it('returns the authenticated session for a known device', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        request_id: 'r1',
        status: 'authenticated',
        user,
        session,
      }),
    );
    const result = await client().bootstrap({
      identifier_kind: 'android_id',
      identifier_value: 'a1b2c3d4e5f60718',
    });
    expect(result.status).toBe('authenticated');
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      identifier_kind: 'android_id',
      identifier_value: 'a1b2c3d4e5f60718',
    });
  });

  it('returns the single-use ticket on 404 ACCOUNT_NOT_FOUND', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(404, {
        request_id: 'r2',
        status: 'failed',
        error: {code: 'ACCOUNT_NOT_FOUND', message: 'No account.'},
        bootstrap_ticket: 'bt_abc',
        bootstrap_ticket_expires_at: '2026-09-14T00:15:00.000Z',
      }),
    );
    const result = await client().bootstrap({
      identifier_kind: 'random_fallback',
      identifier_value: '123e4567-e89b-42d3-a456-426614174000',
    });
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.bootstrap_ticket).toBe('bt_abc');
    }
  });

  it('maps 400 INVALID_DEVICE_IDENTIFIER to a typed api error', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(400, {
        request_id: 'r3',
        status: 'failed',
        error: {code: 'INVALID_DEVICE_IDENTIFIER', message: 'malformed'},
      }),
    );
    await expect(
      client().bootstrap({
        identifier_kind: 'android_id',
        identifier_value: 'x',
      }),
    ).rejects.toMatchObject({
      kind: 'api_error',
      code: 'INVALID_DEVICE_IDENTIFIER',
    });
  });

  it('marks 429 responses retryable', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(429, {
        request_id: 'r4',
        status: 'failed',
        error: {code: 'RATE_LIMITED', message: 'slow down'},
      }),
    );
    await expect(
      client().bootstrap({
        identifier_kind: 'android_id',
        identifier_value: 'x',
      }),
    ).rejects.toMatchObject({
      kind: 'api_error',
      code: 'RATE_LIMITED',
      retryable: true,
    });
  });

  it('maps transport failures to offline, never to an api code', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(
      client().bootstrap({
        identifier_kind: 'android_id',
        identifier_value: 'x',
      }),
    ).rejects.toMatchObject({kind: 'offline'});
  });

  it('rejects a 200 body without the expected shape as invalid_response', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {status: 'authenticated'}),
    );
    await expect(
      client().bootstrap({
        identifier_kind: 'android_id',
        identifier_value: 'x',
      }),
    ).rejects.toMatchObject({kind: 'invalid_response'});
  });
});

describe('authClient users/refresh/logout/me (SETE-303 / T6)', () => {
  const client = () =>
    createAuthClient({fetchImpl: mockFetch, baseUrl: 'http://test'});

  it('sends the Idempotency-Key on account creation', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(201, {request_id: 'r5', status: 'created', user, session}),
    );
    const created = await client().createUser({
      bootstrapTicket: 'bt_abc',
      displayName: 'An',
      phone: null,
      idempotencyKey: 'idem-1',
    });
    expect(created.status).toBe('created');
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe(
      'idem-1',
    );
  });

  it('propagates 409 conflicts for the caller to converge on', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(409, {
        request_id: 'r6',
        status: 'failed',
        error: {code: 'IDEMPOTENCY_CONFLICT', message: 'conflict'},
      }),
    );
    await expect(
      client().createUser({
        bootstrapTicket: 'bt_abc',
        displayName: 'An',
        phone: null,
        idempotencyKey: 'idem-1',
      }),
    ).rejects.toMatchObject({kind: 'api_error', code: 'IDEMPOTENCY_CONFLICT'});
  });

  it('rotates refresh tokens and surfaces replay as SESSION_REPLAYED', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {request_id: 'r7', status: 'rotated', session}),
    );
    const rotated = await client().refresh('lb_rt_refresh');
    expect(rotated.session.session_id).toBe(session.session_id);

    mockFetch.mockResolvedValueOnce(
      jsonResponse(401, {
        request_id: 'r8',
        status: 'failed',
        error: {code: 'SESSION_REPLAYED', message: 'replayed'},
      }),
    );
    await expect(client().refresh('lb_rt_old')).rejects.toMatchObject({
      kind: 'api_error',
      code: 'SESSION_REPLAYED',
    });
  });

  it('treats logout as idempotent: 401 still resolves logged_out', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(401, {
        request_id: 'r9',
        status: 'failed',
        error: {code: 'INVALID_SESSION', message: 'gone'},
      }),
    );
    await expect(client().logout('lb_at_stale')).resolves.toMatchObject({
      status: 'logged_out',
      revoked: false,
    });
  });

  it('sends Bearer tokens on me and PATCHes profile fields on updateMe', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {request_id: 'r10', status: 'success', user}),
    );
    await client().me('lb_at_access');
    const [, meInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((meInit.headers as Record<string, string>).Authorization).toBe(
      'Bearer lb_at_access',
    );

    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        request_id: 'r11',
        status: 'success',
        user: {...user, display_name: 'Bình', phone_e164: '+84901234567'},
      }),
    );
    const updated = await client().updateMe({
      accessToken: 'lb_at_access',
      displayName: 'Bình',
      phone: '+84901234567',
    });
    expect(updated.user.display_name).toBe('Bình');
    const [patchUrl, patchInit] = mockFetch.mock.calls[1] as [
      string,
      RequestInit,
    ];
    expect(patchUrl).toBe('http://test/v1/me');
    expect(patchInit.method).toBe('PATCH');
    expect(JSON.parse(patchInit.body as string)).toEqual({
      display_name: 'Bình',
      phone: '+84901234567',
    });
  });
});
