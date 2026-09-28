import {open} from 'react-native-quick-sqlite';
import * as Keychain from 'react-native-keychain';
import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {DB_NAME} from '@core/db/constants';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import * as DeviceIdentityNative from '@core/identity/deviceIdentityNative';
import {resetBootStateForTests} from '../accountBootstrap';
import {resetRefreshStateForTests} from '@core/auth/authSession';
import {getActiveSession} from '@core/auth/sessionStore';
import {
  installKeychainVault,
  vault,
} from '../../../../test/support/keychainVault';
import {resetAccountStoreForTests, useAccountStore} from '../useAccountStore';
import type {AuthSession, AuthUser} from '@core/auth/index';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const ANDROID_ID = 'a1b2c3d4e5f60718';

const user: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111',
  public_code: 'LB-AB12CD34',
  display_name: 'An',
  phone_e164: null,
  status: 'active',
  created_at: '2026-09-14T00:00:00.000Z',
  updated_at: '2026-09-14T00:00:00.000Z',
};

const freshSession: AuthSession = {
  session_id: '22222222-2222-4222-8222-222222222222',
  access_token: 'lb_at_access',
  refresh_token: 'lb_rt_refresh',
  access_expires_at: new Date(Date.now() + 3600_000).toISOString(),
  refresh_expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
};

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

beforeEach(() => {
  __resetMockDatabases();
  resetDatabaseForTests(open({name: DB_NAME}));
  getDatabase();
  installKeychainVault();
  resetBootStateForTests();
  resetRefreshStateForTests();
  resetAccountStoreForTests();
  mockFetch.mockReset();
  jest
    .spyOn(DeviceIdentityNative, 'readPlatformIdentifiers')
    .mockResolvedValue({androidId: ANDROID_ID, identifierForVendor: null});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useAccountStore navigation flow (SETE-303 / T6)', () => {
  it('moves bootstrapping → needs-onboarding → authenticated deterministically', async () => {
    expect(useAccountStore.getState().phase).toBe('bootstrapping');

    mockFetch.mockResolvedValueOnce(
      jsonResponse(404, {
        request_id: 't1',
        status: 'failed',
        error: {code: 'ACCOUNT_NOT_FOUND', message: 'No account.'},
        bootstrap_ticket: 'bt_ticket_1',
        bootstrap_ticket_expires_at: new Date(
          Date.now() + 900_000,
        ).toISOString(),
      }),
    );
    await useAccountStore.getState().boot();
    expect(useAccountStore.getState().phase).toBe('needs-onboarding');
    expect(useAccountStore.getState().bootstrapTicket).toBe('bt_ticket_1');

    mockFetch.mockResolvedValueOnce(
      jsonResponse(201, {
        request_id: 'c1',
        status: 'created',
        user,
        session: freshSession,
      }),
    );
    await useAccountStore.getState().submitDisplayName('An');
    const state = useAccountStore.getState();
    expect(state.phase).toBe('authenticated');
    expect(state.user).toEqual(user);
  });

  it('reaches authenticated directly for a known device', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        request_id: 'b1',
        status: 'authenticated',
        user,
        session: freshSession,
      }),
    );
    await useAccountStore.getState().boot();
    expect(useAccountStore.getState().phase).toBe('authenticated');
  });

  it('lands on offline and recovers through retry', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));
    await useAccountStore.getState().boot();
    expect(useAccountStore.getState().phase).toBe('offline');

    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        request_id: 'b2',
        status: 'authenticated',
        user,
        session: freshSession,
      }),
    );
    await useAccountStore.getState().retry();
    expect(useAccountStore.getState().phase).toBe('authenticated');
  });
});

describe('useAccountStore logout (TASK-005 signed-out lifecycle)', () => {
  function loggedOutResponse() {
    return jsonResponse(200, {
      request_id: 'l1',
      status: 'logged_out',
      revoked: true,
    });
  }

  function knownDeviceResponse() {
    return jsonResponse(200, {
      request_id: 'b1',
      status: 'authenticated',
      user,
      session: freshSession,
    });
  }

  async function bootToAuthenticated() {
    mockFetch.mockResolvedValueOnce(knownDeviceResponse());
    await useAccountStore.getState().boot();
    expect(useAccountStore.getState().phase).toBe('authenticated');
  }

  function logoutCallCount() {
    return mockFetch.mock.calls.filter(([url]) =>
      String(url).includes('/v1/auth/logout'),
    ).length;
  }

  it('signs out online into a stable signed-out gate with cleared state', async () => {
    await bootToAuthenticated();
    mockFetch.mockResolvedValueOnce(loggedOutResponse());

    await useAccountStore.getState().logout();

    const state = useAccountStore.getState();
    expect(state.phase).toBe('signed-out');
    expect(state.user).toBeNull();
    expect(state.bootstrapTicket).toBeNull();
    expect(state.bootstrapTicketExpiresAt).toBeNull();
    expect(state.failureCode).toBeNull();
    expect(state.failureMessage).toBeNull();
    await expect(getActiveSession()).resolves.toEqual({
      ok: true,
      value: null,
    });
  });

  it('signs out locally when the server call is offline but the wipe succeeds', async () => {
    await bootToAuthenticated();
    mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));

    await useAccountStore.getState().logout();

    expect(useAccountStore.getState().phase).toBe('signed-out');
    await expect(getActiveSession()).resolves.toEqual({
      ok: true,
      value: null,
    });
  });

  it('resolves missing-token logout to signed-out without failing', async () => {
    expect(useAccountStore.getState().phase).toBe('bootstrapping');
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        request_id: 'l0',
        status: 'logged_out',
        revoked: false,
      }),
    );

    await useAccountStore.getState().logout();

    expect(useAccountStore.getState().phase).toBe('signed-out');
    expect(logoutCallCount()).toBe(1);
  });

  it('keeps the session and reports KEYCHAIN_ERROR when the wipe fails', async () => {
    await bootToAuthenticated();
    mockFetch.mockResolvedValueOnce(loggedOutResponse());
    (Keychain.resetGenericPassword as jest.Mock).mockRejectedValueOnce(
      new Error('keychain locked'),
    );

    await useAccountStore.getState().logout();

    const state = useAccountStore.getState();
    expect(state.phase).toBe('authenticated');
    expect(state.user).toEqual(user);
    expect(state.failureCode).toBe('KEYCHAIN_ERROR');
    expect(state.failureMessage).toBeTruthy();
    await expect(getActiveSession()).resolves.toMatchObject({ok: true});
  });

  it('shares one server logout across concurrent calls', async () => {
    await bootToAuthenticated();
    mockFetch.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          setTimeout(() => resolve(loggedOutResponse()), 10);
        }),
    );

    await Promise.all([
      useAccountStore.getState().logout(),
      useAccountStore.getState().logout(),
    ]);

    expect(logoutCallCount()).toBe(1);
    expect(useAccountStore.getState().phase).toBe('signed-out');
  });

  it('rejoins boot through retry (Continue) after signed-out', async () => {
    await bootToAuthenticated();
    mockFetch.mockResolvedValueOnce(loggedOutResponse());
    await useAccountStore.getState().logout();
    expect(useAccountStore.getState().phase).toBe('signed-out');

    mockFetch.mockResolvedValueOnce(knownDeviceResponse());
    await useAccountStore.getState().retry();

    const state = useAccountStore.getState();
    expect(state.phase).toBe('authenticated');
    expect(state.user).toEqual(user);
  });

  it('cold start resets to bootstrapping, not signed-out', async () => {
    await bootToAuthenticated();
    mockFetch.mockResolvedValueOnce(loggedOutResponse());
    await useAccountStore.getState().logout();
    expect(useAccountStore.getState().phase).toBe('signed-out');

    resetAccountStoreForTests();
    expect(useAccountStore.getState().phase).toBe('bootstrapping');
  });

  it('CR-001 / AF-002: stale boot after logout stays signed-out with cleared pointer', async () => {
    await bootToAuthenticated();
    let releaseBoot!: () => void;
    const bootGate = new Promise<void>(resolve => {
      releaseBoot = resolve;
    });
    mockFetch.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/v1/auth/logout')) {
        return loggedOutResponse();
      }
      if (String(url).endsWith('/v1/me')) {
        await bootGate;
      }
      return knownDeviceResponse();
    });

    const staleBoot = useAccountStore.getState().boot();
    mockFetch.mockResolvedValueOnce(loggedOutResponse());
    await useAccountStore.getState().logout();
    expect(useAccountStore.getState().phase).toBe('signed-out');
    releaseBoot();
    await staleBoot;
    expect(useAccountStore.getState().phase).toBe('signed-out');
    await expect(getActiveSession()).resolves.toEqual({ok: true, value: null});
  });

  it('clears auth keychain entries but keeps non-auth entries and SQLite data', async () => {
    await bootToAuthenticated();
    vault.set('com.example.unrelated', {username: 'u', password: 'p'});
    getDatabase().execute(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      ['account.last_account_id', user.id, new Date().toISOString()],
    );
    mockFetch.mockResolvedValueOnce(loggedOutResponse());

    await useAccountStore.getState().logout();

    expect(useAccountStore.getState().phase).toBe('signed-out');
    const services = [...vault.keys()];
    expect(
      services.filter(service => service.startsWith('com.lingobites.auth.')),
    ).toEqual([]);
    expect(vault.get('com.example.unrelated')).toEqual({
      username: 'u',
      password: 'p',
    });
    const row = getDatabase()
      .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [
        'account.last_account_id',
      ])
      .rows?.item(0) as {value?: string} | undefined;
    expect(row?.value).toBe(user.id);
  });
});
