import {createAuthClient} from '../authClient';
import type {AuthSession, AuthUser} from '../authTypes';

/**
 * Mobile auth contract parity fixtures (TASK-004): hand-written mirror of
 * the approved Section 6 contract. Every approved success/error shape must
 * parse; malformed 2xx bodies must reject; wire conventions (prefixed opaque
 * tokens, Idempotency-Key on creation, bodyless logout) are pinned here so
 * Server/App drift fails fast. Fixture secrets are opaque representative
 * values — the client round-trips them byte-identically and never inspects
 * their internals.
 */

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const ACCESS_TOKEN = 'lb_at_xK9mQ2vT7wZ4nB6cD8eF0gH1jL3kM5pR7sU9wY2';
const REFRESH_TOKEN = 'lb_rt_pL4mK8nB2vC6xZ0aS4dF8gH2jK6lM0nQ4rT8uW2y';
const ROTATED_ACCESS = 'lb_at_mN7bV3cX9zL2kJ6hG4fD8sA0pO2iU6yT4rE8wQ1';
const ROTATED_REFRESH = 'lb_rt_qW5eR3tY7uI9oP2aS4dF6gH8jK0lZ3xC5vB7nM2';
const BOOTSTRAP_TICKET = 'bt_kP8mN2bV5cX8zLqW4eR7tY3uI6oP9aS2dF5g';

const user: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111',
  public_code: 'LB-AB12CD34',
  display_name: 'An',
  phone_e164: null,
  status: 'active',
  created_at: '2026-09-14T00:00:00.000Z',
  updated_at: '2026-09-14T00:00:00.000Z',
};

function session(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    session_id: '22222222-2222-4222-8222-222222222222',
    access_token: ACCESS_TOKEN,
    refresh_token: REFRESH_TOKEN,
    access_expires_at: '2026-09-14T01:00:00.000Z',
    refresh_expires_at: '2026-10-14T00:00:00.000Z',
    ...overrides,
  };
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

function mergeInProgress(requestId: string) {
  return jsonResponse(409, {
    request_id: requestId,
    status: 'failed',
    error: {code: 'MERGE_IN_PROGRESS', message: 'Account merging.'},
    retryable: true,
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('auth contract success fixtures (TASK-004 Section 6)', () => {
  const client = () =>
    createAuthClient({fetchImpl: mockFetch, baseUrl: 'http://test'});

  it('accepts known-device bootstrap with opaque prefixed tokens', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        request_id: 'r1',
        status: 'authenticated',
        user,
        session: session(),
      }),
    );
    const result = await client().bootstrap({
      identifier_kind: 'android_id',
      identifier_value: 'a1b2c3d4e5f60718',
    });
    expect(result.status).toBe('authenticated');
    if (result.status === 'authenticated') {
      expect(result.session.access_token).toBe(ACCESS_TOKEN);
      expect(result.session.refresh_token).toBe(REFRESH_TOKEN);
    }
  });

  it('accepts new-device bootstrap ticket', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(404, {
        request_id: 'r2',
        status: 'failed',
        error: {code: 'ACCOUNT_NOT_FOUND', message: 'No account.'},
        bootstrap_ticket: BOOTSTRAP_TICKET,
        bootstrap_ticket_expires_at: '2026-09-14T00:10:00.000Z',
      }),
    );
    const result = await client().bootstrap({
      identifier_kind: 'ios_ifv',
      identifier_value: '123E4567-E89B-42D3-A456-426614174000',
    });
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.bootstrap_ticket).toBe(BOOTSTRAP_TICKET);
    }
  });

  it('accepts account creation as 201 created and 200 race convergence', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(201, {
        request_id: 'r3',
        status: 'created',
        user,
        session: session(),
      }),
    );
    const created = await client().createUser({
      bootstrapTicket: BOOTSTRAP_TICKET,
      displayName: 'An',
      phone: null,
      idempotencyKey: 'idem-1',
    });
    expect(created.status).toBe('created');

    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        request_id: 'r4',
        status: 'authenticated',
        user,
        session: session(),
      }),
    );
    const converged = await client().createUser({
      bootstrapTicket: BOOTSTRAP_TICKET,
      displayName: 'An',
      phone: null,
      idempotencyKey: 'idem-2',
    });
    expect(converged.status).toBe('authenticated');
    expect(converged.session.access_token).toBe(ACCESS_TOKEN);
  });

  it('accepts rotated refresh sessions with new opaque values', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        request_id: 'r5',
        status: 'rotated',
        session: session({
          access_token: ROTATED_ACCESS,
          refresh_token: ROTATED_REFRESH,
        }),
      }),
    );
    const rotated = await client().refresh(REFRESH_TOKEN);
    expect(rotated.status).toBe('rotated');
    expect(rotated.session.access_token).toBe(ROTATED_ACCESS);
    expect(rotated.session.refresh_token).toBe(ROTATED_REFRESH);
  });

  it('accepts idempotent logout with revoked true and false', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        request_id: 'r6',
        status: 'logged_out',
        revoked: true,
      }),
    );
    await expect(client().logout(ACCESS_TOKEN)).resolves.toMatchObject({
      status: 'logged_out',
      revoked: true,
    });

    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        request_id: 'r7',
        status: 'logged_out',
        revoked: false,
      }),
    );
    await expect(client().logout(null)).resolves.toMatchObject({
      status: 'logged_out',
      revoked: false,
    });
  });

  it('accepts profile read with Bearer [REDACTED]', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {request_id: 'r8', status: 'success', user}),
    );
    const me = await client().me(ACCESS_TOKEN);
    expect(me.user).toEqual(user);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${ACCESS_TOKEN}`,
    );
  });
});

describe('auth contract error fixtures (TASK-004 Section 6)', () => {
  const client = () =>
    createAuthClient({fetchImpl: mockFetch, baseUrl: 'http://test'});

  it('parses refresh 409 MERGE_IN_PROGRESS as retryable without changing behavior', async () => {
    mockFetch.mockResolvedValueOnce(mergeInProgress('r9'));
    await expect(client().refresh(REFRESH_TOKEN)).rejects.toMatchObject({
      kind: 'api_error',
      httpStatus: 409,
      code: 'MERGE_IN_PROGRESS',
      retryable: true,
    });
  });

  it('parses profile 409 MERGE_IN_PROGRESS as retryable', async () => {
    mockFetch.mockResolvedValueOnce(mergeInProgress('r10'));
    await expect(client().me(ACCESS_TOKEN)).rejects.toMatchObject({
      kind: 'api_error',
      httpStatus: 409,
      code: 'MERGE_IN_PROGRESS',
      retryable: true,
    });
  });

  it('surfaces refresh replay as non-retryable SESSION_REPLAYED', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(401, {
        request_id: 'r11',
        status: 'failed',
        error: {code: 'SESSION_REPLAYED', message: 'replayed'},
      }),
    );
    await expect(client().refresh(REFRESH_TOKEN)).rejects.toMatchObject({
      kind: 'api_error',
      code: 'SESSION_REPLAYED',
      retryable: false,
    });
  });

  it('maps bootstrap 503 DATABASE_UNAVAILABLE as retryable', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(503, {
        request_id: 'r12',
        status: 'failed',
        error: {code: 'DATABASE_UNAVAILABLE', message: 'down'},
      }),
    );
    await expect(
      client().bootstrap({
        identifier_kind: 'random_fallback',
        identifier_value: '123e4567-e89b-42d3-a456-426614174000',
      }),
    ).rejects.toMatchObject({
      kind: 'api_error',
      code: 'DATABASE_UNAVAILABLE',
      retryable: true,
    });
  });

  it('propagates creation 409 IDEMPOTENCY_CONFLICT', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(409, {
        request_id: 'r13',
        status: 'failed',
        error: {code: 'IDEMPOTENCY_CONFLICT', message: 'conflict'},
      }),
    );
    await expect(
      client().createUser({
        bootstrapTicket: BOOTSTRAP_TICKET,
        displayName: 'An',
        phone: null,
        idempotencyKey: 'idem-1',
      }),
    ).rejects.toMatchObject({
      kind: 'api_error',
      code: 'IDEMPOTENCY_CONFLICT',
    });
  });
});

describe('auth contract shape rejection (TASK-004)', () => {
  const client = () =>
    createAuthClient({fetchImpl: mockFetch, baseUrl: 'http://test'});

  it('rejects malformed 2xx bodies as invalid_response', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(201, {request_id: 'bad', status: 'created', user}),
    );
    await expect(
      client().createUser({
        bootstrapTicket: BOOTSTRAP_TICKET,
        displayName: 'An',
        phone: null,
        idempotencyKey: 'idem-1',
      }),
    ).rejects.toMatchObject({kind: 'invalid_response'});

    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {request_id: 'bad', status: 'rotated'}),
    );
    await expect(client().refresh(REFRESH_TOKEN)).rejects.toMatchObject({
      kind: 'invalid_response',
    });

    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {request_id: 'bad', status: 'logged_out'}),
    );
    await expect(client().logout(ACCESS_TOKEN)).rejects.toMatchObject({
      kind: 'invalid_response',
    });

    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {request_id: 'bad', status: 'success'}),
    );
    await expect(client().me(ACCESS_TOKEN)).rejects.toMatchObject({
      kind: 'invalid_response',
    });
  });
});

describe('auth contract wire conventions (TASK-004)', () => {
  const client = () =>
    createAuthClient({fetchImpl: mockFetch, baseUrl: 'http://test'});

  it('sends Idempotency-Key on creation and only there', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(201, {
        request_id: 'r14',
        status: 'created',
        user,
        session: session(),
      }),
    );
    await client().createUser({
      bootstrapTicket: BOOTSTRAP_TICKET,
      displayName: 'An',
      phone: null,
      idempotencyKey: 'idem-9',
    });
    const [, createInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(
      (createInit.headers as Record<string, string>)['Idempotency-Key'],
    ).toBe('idem-9');

    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        request_id: 'r14b',
        status: 'authenticated',
        user,
        session: session(),
      }),
    );
    await client().bootstrap({
      identifier_kind: 'android_id',
      identifier_value: 'a1b2c3d4e5f60718',
    });
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        request_id: 'r14c',
        status: 'rotated',
        session: session(),
      }),
    );
    await client().refresh(REFRESH_TOKEN);
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        request_id: 'r14d',
        status: 'logged_out',
        revoked: true,
      }),
    );
    await client().logout(ACCESS_TOKEN);
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {request_id: 'r14e', status: 'success', user}),
    );
    await client().me(ACCESS_TOKEN);
    for (const [, init] of mockFetch.mock.calls as [string, RequestInit][]) {
      expect(
        (init.headers as Record<string, string>)['Idempotency-Key'],
      ).toBeUndefined();
    }
  });

  it('sends a bodyless logout with no Idempotency-Key', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        request_id: 'r15',
        status: 'logged_out',
        revoked: true,
      }),
    );
    await client().logout(ACCESS_TOKEN);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://test/v1/auth/logout');
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
    expect(init.headers).not.toMatchObject({
      'Idempotency-Key': expect.anything(),
    });
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${ACCESS_TOKEN}`,
    );
  });

  it('treats tokens as opaque: prefixes preserved, internals never read', async () => {
    for (const token of [
      ACCESS_TOKEN,
      REFRESH_TOKEN,
      ROTATED_ACCESS,
      ROTATED_REFRESH,
    ]) {
      expect(token).toMatch(/^(lb_at_|lb_rt_)/);
    }
    expect(BOOTSTRAP_TICKET).toMatch(/^bt_/);

    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        request_id: 'r16',
        status: 'authenticated',
        user,
        session: session(),
      }),
    );
    const bootstrapped = await client().bootstrap({
      identifier_kind: 'android_id',
      identifier_value: 'a1b2c3d4e5f60718',
    });
    if (bootstrapped.status !== 'authenticated') {
      throw new Error('fixture must authenticate');
    }
    // Opaque round-trip: the client returns token strings byte-identical.
    expect(bootstrapped.session.access_token).toBe(ACCESS_TOKEN);
    expect(bootstrapped.session.refresh_token).toBe(REFRESH_TOKEN);
  });
});
