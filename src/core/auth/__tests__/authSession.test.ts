import {
  ensureValidSession,
  persistNewSession,
  resetRefreshStateForTests,
  signOut,
} from '../authSession';
import {getActiveSession} from '../sessionStore';
import type {AuthHttpClient} from '../authClient';
import type {AuthSession, AuthUser} from '../authTypes';
import {installKeychainVault} from '../../../test-support/keychainVault';

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
    access_token: 'lb_at_access',
    refresh_token: 'lb_rt_refresh',
    access_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    refresh_expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
    ...overrides,
  };
}

function expiredSession(): AuthSession {
  return session({
    access_expires_at: new Date(Date.now() - 1000).toISOString(),
  });
}

function stubClient(overrides: Partial<AuthHttpClient> = {}): AuthHttpClient {
  return {
    bootstrap: jest.fn(),
    createUser: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    me: jest.fn(),
    updateMe: jest.fn(),
    ...overrides,
  } as AuthHttpClient;
}

beforeEach(() => {
  installKeychainVault();
  resetRefreshStateForTests();
});

describe('authSession refresh lifecycle (SETE-303 / T6)', () => {
  it('returns a fresh access token without network traffic', async () => {
    const client = stubClient();
    await persistNewSession({session: session(), user});
    const result = await ensureValidSession({client});
    expect(result.status).toBe('valid');
    expect(client.refresh).not.toHaveBeenCalled();
  });

  it('serializes concurrent refreshes into a single rotation', async () => {
    const rotated = session({
      session_id: 'new-session',
      access_token: 'lb_at_new',
    });
    let resolveRefresh!: (value: {
      request_id: string;
      status: 'rotated';
      session: AuthSession;
    }) => void;
    const client = stubClient({
      refresh: jest.fn(
        () =>
          new Promise(resolve => {
            resolveRefresh = resolve as typeof resolveRefresh;
          }),
      ),
    });
    await persistNewSession({session: expiredSession(), user});

    const first = ensureValidSession({client});
    const second = ensureValidSession({client});
    for (
      let i = 0;
      i < 20 && (client.refresh as jest.Mock).mock.calls.length === 0;
      i++
    ) {
      await new Promise(resolve => setImmediate(resolve));
    }
    resolveRefresh({request_id: 'r', status: 'rotated', session: rotated});
    const [a, b] = await Promise.all([first, second]);

    expect(client.refresh).toHaveBeenCalledTimes(1);
    expect(a).toEqual({status: 'valid', session: rotated, userId: user.id});
    expect(b).toEqual({status: 'valid', session: rotated, userId: user.id});
    // The rotated session is active and the dead id is dropped.
    await expect(getActiveSession()).resolves.toMatchObject({
      ok: true,
      value: {session_id: 'new-session'},
    });
  });

  it('terminally resets on SESSION_REPLAYED and never retries the family', async () => {
    const client = stubClient({
      refresh: jest.fn().mockRejectedValue({
        kind: 'api_error',
        httpStatus: 401,
        code: 'SESSION_REPLAYED',
        message: 'replayed',
        retryable: false,
      }),
      logout: jest.fn().mockResolvedValue({
        request_id: 'r',
        status: 'logged_out',
        revoked: true,
      }),
    });
    await persistNewSession({session: expiredSession(), user});
    await expect(ensureValidSession({client})).resolves.toEqual({
      status: 'reset',
      reason: 'SESSION_REPLAYED',
    });
    // Terminal: every stored session is gone, including the active pointer.
    await expect(getActiveSession()).resolves.toEqual({ok: true, value: null});
    expect(client.refresh).toHaveBeenCalledTimes(1);
  });

  it('keeps the stored session on transient refresh failures', async () => {
    const client = stubClient({
      refresh: jest.fn().mockRejectedValue({
        kind: 'api_error',
        httpStatus: 503,
        code: 'DATABASE_UNAVAILABLE',
        message: 'down',
        retryable: true,
      }),
    });
    await persistNewSession({session: expiredSession(), user});
    await expect(ensureValidSession({client})).resolves.toMatchObject({
      status: 'refresh-failed',
      code: 'DATABASE_UNAVAILABLE',
    });
    await expect(getActiveSession()).resolves.toMatchObject({
      ok: true,
      value: {session_id: expiredSession().session_id},
    });
  });

  it('reports offline without touching stored sessions', async () => {
    const client = stubClient({
      refresh: jest
        .fn()
        .mockRejectedValue({kind: 'offline', message: 'no net'}),
      me: jest.fn(),
    });
    await persistNewSession({session: expiredSession(), user});
    await expect(ensureValidSession({client})).resolves.toMatchObject({
      status: 'offline',
    });
    await expect(getActiveSession()).resolves.toMatchObject({ok: true});
  });

  it('signs out with best-effort server logout then wipes sessions', async () => {
    const client = stubClient({
      logout: jest.fn().mockRejectedValue({kind: 'offline', message: 'no net'}),
    });
    await persistNewSession({session: session(), user});
    await expect(signOut({client})).resolves.toEqual({ok: true});
    await expect(getActiveSession()).resolves.toEqual({ok: true, value: null});
  });
});
