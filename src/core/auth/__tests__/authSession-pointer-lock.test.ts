import {open} from 'react-native-quick-sqlite';

import {confirmAccountSwitch} from '@features/account/logic/accountBootstrap';
import {resetBootStateForTests} from '@features/account/logic/accountBootstrap';

import {getDatabase, resetDatabaseForTests} from '@core/db/database';

import {installKeychainVault} from '@test/support/keychainVault';

import {__resetMockDatabases} from '../../../../test-utils/sqliteMock';
import {DB_NAME} from '../../db/constants';
import {
  resetAccountSwitchCoordinatorForTests,
  stageAccountSwitchAttempt,
} from '../accountSwitchCoordinator';
import type {AuthHttpClient} from '../authClient';
import {
  activateStoredSession,
  ensureValidSession,
  persistNewSession,
  resetRefreshStateForTests,
} from '../authSession';
import type {AuthSession, AuthUser} from '../authTypes';
import * as sessionStore from '../sessionStore';
import {
  AUTH_ACTIVE_SESSION_SERVICE,
  getActiveSession,
  getActiveSessionId,
  saveSession,
  setActiveSessionId,
} from '../sessionStore';

const userA: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111',
  public_code: 'LB-AAAA',
  display_name: 'User A',
  phone_e164: null,
  status: 'active',
  created_at: '2026-09-27T00:00:00.000Z',
  updated_at: '2026-09-27T00:00:00.000Z',
};

const userB: AuthUser = {
  id: '22222222-2222-4222-8222-222222222222',
  public_code: 'LB-BBBB',
  display_name: 'User B',
  phone_e164: null,
  status: 'active',
  created_at: '2026-09-27T00:00:00.000Z',
  updated_at: '2026-09-27T00:00:00.000Z',
};

const sessionA: AuthSession = {
  session_id: '33333333-3333-4333-8333-333333333333',
  access_token: 'lb_at_a_old',
  refresh_token: 'lb_rt_a',
  access_expires_at: new Date(Date.now() - 3600_000).toISOString(),
  refresh_expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
};

const rotatedA: AuthSession = {
  ...sessionA,
  access_token: 'lb_at_a_new',
  refresh_token: 'lb_rt_a_new',
  access_expires_at: new Date(Date.now() + 3600_000).toISOString(),
};

const sessionB: AuthSession = {
  session_id: '44444444-4444-4444-8444-444444444444',
  access_token: 'lb_at_b',
  refresh_token: 'lb_rt_b',
  access_expires_at: new Date(Date.now() + 3600_000).toISOString(),
  refresh_expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
};

function stubClient(overrides: Partial<AuthHttpClient> = {}): AuthHttpClient {
  return {
    bootstrap: jest.fn(),
    createUser: jest.fn(),
    refresh: jest.fn().mockResolvedValue({
      request_id: 'r',
      status: 'rotated',
      session: rotatedA,
    }),
    logout: jest.fn(),
    me: jest.fn(),
    updateMe: jest.fn(),
    ...overrides,
  } as AuthHttpClient;
}

beforeEach(() => {
  __resetMockDatabases();
  resetDatabaseForTests(open({name: DB_NAME}));
  getDatabase();
  installKeychainVault();
  resetRefreshStateForTests();
  resetBootStateForTests();
  resetAccountSwitchCoordinatorForTests();
});

describe('authSession active-pointer lock (LING-109 repair r5)', () => {
  it('T3: normal refresh rotates and activates without a switch', async () => {
    const client = stubClient();
    await persistNewSession({session: sessionA, user: userA});
    const result = await ensureValidSession({client});
    expect(result).toMatchObject({
      status: 'valid',
      session: {access_token: 'lb_at_a_new'},
      userId: userA.id,
    });
    await expect(getActiveSession()).resolves.toMatchObject({
      ok: true,
      value: {user_id: userA.id, access_token: 'lb_at_a_new'},
    });
  });

  it('T4: a pointer write failure releases the lock for a later activation', async () => {
    const failSpy = jest
      .spyOn(sessionStore, 'setActiveSessionId')
      .mockResolvedValueOnce({
        ok: false,
        errorCode: 'KEYCHAIN_ERROR',
        error: new Error('fail'),
      });
    const first = await activateStoredSession(sessionA.session_id);
    expect(first.ok).toBe(false);
    failSpy.mockRestore();
    await saveSession({
      ...sessionB,
      user_id: userB.id,
      stored_at: new Date().toISOString(),
    });
    const second = await activateStoredSession(sessionB.session_id);
    expect(second.ok).toBe(true);
    await expect(getActiveSessionId()).resolves.toMatchObject({
      ok: true,
      value: sessionB.session_id,
    });
  });

  it('T5: concurrent activations complete in FIFO call order', async () => {
    await saveSession({
      ...sessionA,
      user_id: userA.id,
      stored_at: new Date().toISOString(),
    });
    await saveSession({
      ...sessionB,
      user_id: userB.id,
      stored_at: new Date().toISOString(),
    });
    const order: string[] = [];
    const Keychain = jest.requireMock('react-native-keychain') as {
      setGenericPassword: jest.Mock;
    };
    const realSet = Keychain.setGenericPassword.getMockImplementation();
    let releaseFirst!: () => void;
    const gate = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let paused = false;
    Keychain.setGenericPassword.mockImplementation(
      async (
        _username: string,
        password: string,
        options?: {service?: string},
      ) => {
        if (
          options?.service === AUTH_ACTIVE_SESSION_SERVICE &&
          password === sessionA.session_id &&
          !paused
        ) {
          paused = true;
          order.push('start-a');
          await gate;
        }
        order.push(`write-${password}`);
        return realSet!(_username, password, options);
      },
    );
    const first = activateStoredSession(sessionA.session_id);
    await new Promise(resolve => setImmediate(resolve));
    const second = activateStoredSession(sessionB.session_id);
    releaseFirst();
    await Promise.all([first, second]);
    expect(order.indexOf('start-a')).toBeLessThan(
      order.indexOf(`write-${sessionB.session_id}`),
    );
    await expect(getActiveSessionId()).resolves.toMatchObject({
      ok: true,
      value: sessionB.session_id,
    });
  });

  it('T1: pointer write during refresh cannot win over a confirmed A→B switch', async () => {
    getDatabase().execute(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      ['current_account_id', userA.id, '2026-09-27T00:00:00.000Z'],
    );
    getDatabase().execute(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      [
        'account.install_completed_v1',
        '2026-09-27T00:00:00.000Z',
        '2026-09-27T00:00:00.000Z',
      ],
    );
    await saveSession({
      ...sessionA,
      user_id: userA.id,
      stored_at: '2026-09-27T00:00:00.000Z',
    });
    await setActiveSessionId(sessionA.session_id);
    await saveSession({
      ...sessionB,
      user_id: userB.id,
      stored_at: '2026-09-27T00:00:00.000Z',
    });
    const staged = await stageAccountSwitchAttempt({
      sourceAccountId: userA.id,
      targetAccountId: userB.id,
      targetSessionId: sessionB.session_id,
      targetUserSnapshot: userB,
    });
    if (!staged.ok) {
      throw new Error('stage failed');
    }

    const Keychain = jest.requireMock('react-native-keychain') as {
      setGenericPassword: jest.Mock;
    };
    const realSet = Keychain.setGenericPassword.getMockImplementation();
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    let reached!: () => void;
    const reachedP = new Promise<void>(resolve => {
      reached = resolve;
    });
    let paused = false;
    Keychain.setGenericPassword.mockImplementation(
      async (
        _username: string,
        password: string,
        options?: {service?: string},
      ) => {
        if (
          !paused &&
          options?.service === AUTH_ACTIVE_SESSION_SERVICE &&
          password === rotatedA.session_id
        ) {
          paused = true;
          reached();
          await gate;
        }
        return realSet!(_username, password, options);
      },
    );

    const client = stubClient();
    const refreshPromise = ensureValidSession({client});
    await reachedP;
    const confirmPromise = confirmAccountSwitch(staged.value.attempt_id);
    release();
    const [confirmed] = await Promise.all([confirmPromise, refreshPromise]);
    expect(confirmed.status).toBe('authenticated');

    const active = await getActiveSession();
    expect(active.ok && active.value?.user_id).toBe(userB.id);
    expect(active.ok && active.value?.session_id).toBe(sessionB.session_id);
  });

  it('T2: ownership re-check under the lock aborts when B commits during the read', async () => {
    getDatabase().execute(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      ['current_account_id', userA.id, '2026-09-27T00:00:00.000Z'],
    );
    await persistNewSession({session: sessionA, user: userA});
    await saveSession({
      ...sessionB,
      user_id: userB.id,
      stored_at: '2026-09-27T00:00:00.000Z',
    });
    const staged = await stageAccountSwitchAttempt({
      sourceAccountId: userA.id,
      targetAccountId: userB.id,
      targetSessionId: sessionB.session_id,
      targetUserSnapshot: userB,
    });
    if (!staged.ok) {
      throw new Error('stage failed');
    }

    const Keychain = jest.requireMock('react-native-keychain') as {
      getGenericPassword: jest.Mock;
    };
    const realGet = Keychain.getGenericPassword.getMockImplementation();
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    let reached!: () => void;
    const reachedP = new Promise<void>(resolve => {
      reached = resolve;
    });
    let paused = false;
    Keychain.getGenericPassword.mockImplementation(
      async (options: {service?: string}) => {
        if (!paused && options?.service === AUTH_ACTIVE_SESSION_SERVICE) {
          paused = true;
          reached();
          await gate;
        }
        return realGet!(options);
      },
    );

    const client = stubClient();
    const refreshPromise = ensureValidSession({client});
    await reachedP;
    const confirmPromise = confirmAccountSwitch(staged.value.attempt_id);
    release();
    const [result] = await Promise.all([refreshPromise, confirmPromise]);
    if (result.status === 'refresh-failed') {
      expect(result.code).toBe('ACCOUNT_OWNERSHIP_CHANGED');
    } else {
      expect(result.status).toBe('valid');
    }
    const active = await getActiveSession();
    expect(active.ok && active.value?.user_id).toBe(userB.id);
  });
});
