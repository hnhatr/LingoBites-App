import {open} from 'react-native-quick-sqlite';
import {__resetMockDatabases} from '../../../../test-utils/sqliteMock';
import {DB_NAME} from '../../db/constants';
import {getDatabase, resetDatabaseForTests} from '../../db/database';
import * as DeviceIdentityNative from '../../identity/deviceIdentityNative';
import {bootAccount, resetBootStateForTests} from '../accountBootstrap';
import {
  confirmAccountSwitchAttempt,
  resetAccountSwitchCoordinatorForTests,
  stageAccountSwitchAttempt,
} from '../accountSwitchCoordinator';
import {ACCOUNT_SWITCH_JOURNAL_SERVICE} from '../accountSwitchJournal';
import {resetRefreshStateForTests} from '../authSession';
import {saveSession, setActiveSessionId} from '../sessionStore';
import type {AuthSession, AuthUser} from '../authTypes';
import {installKeychainVault} from '@/test-support/keychainVault';

jest.mock('../../db/legacyClear', () => ({
  executeLegacyClear: jest.fn().mockResolvedValue(undefined),
  executeCanonicalLegacyClear: jest.fn().mockResolvedValue(undefined),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

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
  access_token: 'lb_at_a',
  refresh_token: 'lb_rt_a',
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

function seedInstallForA() {
  const db = getDatabase();
  db.execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    ['current_account_id', userA.id, '2026-09-27T00:00:00.000Z'],
  );
  db.execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    [
      'account.install_completed_v1',
      '2026-09-27T00:00:00.000Z',
      '2026-09-27T00:00:00.000Z',
    ],
  );
}

async function seedActiveSessionA() {
  await saveSession({
    ...sessionA,
    user_id: userA.id,
    stored_at: '2026-09-27T00:00:00.000Z',
  });
  await setActiveSessionId(sessionA.session_id);
}

beforeEach(async () => {
  __resetMockDatabases();
  resetDatabaseForTests(open({name: DB_NAME}));
  getDatabase();
  installKeychainVault();
  resetBootStateForTests();
  resetRefreshStateForTests();
  resetAccountSwitchCoordinatorForTests();
  mockFetch.mockReset();
  jest
    .spyOn(DeviceIdentityNative, 'readPlatformIdentifiers')
    .mockResolvedValue({
      androidId: 'android-id-1',
      identifierForVendor: null,
    });
  await seedActiveSessionA();
  seedInstallForA();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('accountBootstrap recovery truth table (AC-015 / AD-005)', () => {
  it('awaiting + source A → switch-confirmation before Keychain cleanup', async () => {
    await stageAccountSwitchAttempt({
      sourceAccountId: userA.id,
      targetAccountId: userB.id,
      targetSessionId: '44444444-4444-4444-8444-444444444444',
      targetUserSnapshot: userB,
    });
    mockFetch.mockImplementation(async (url: string) => {
      if (url.endsWith('/v1/auth/me')) {
        return jsonResponse(200, {
          request_id: 'm1',
          status: 'success',
          user: userA,
        });
      }
      return jsonResponse(404, {});
    });

    const result = await bootAccount({platform: 'android'});
    expect(result.status).toBe('switch-confirmation');
    if (result.status === 'switch-confirmation') {
      expect(result.switch.needsRetry).toBe(false);
      expect(result.switch.sourceAccountId).toBe(userA.id);
    }
    expect(
      mockFetch.mock.calls.some(([url]) =>
        String(url).endsWith('/v1/auth/bootstrap'),
      ),
    ).toBe(false);
  });

  it('confirmed + source A → switch-confirmation with needsRetry', async () => {
    const staged = await stageAccountSwitchAttempt({
      sourceAccountId: userA.id,
      targetAccountId: userB.id,
      targetSessionId: '44444444-4444-4444-8444-444444444444',
      targetUserSnapshot: userB,
    });
    if (!staged.ok) {
      throw new Error('stage failed');
    }
    await confirmAccountSwitchAttempt(staged.value.attempt_id, {
      sourceAccountId: userA.id,
      targetAccountId: userB.id,
    });
    mockFetch.mockImplementation(async (url: string) => {
      if (url.endsWith('/v1/auth/me')) {
        return jsonResponse(200, {
          request_id: 'm1',
          status: 'success',
          user: userA,
        });
      }
      return jsonResponse(404, {});
    });

    const result = await bootAccount({platform: 'android'});
    expect(result.status).toBe('switch-confirmation');
    if (result.status === 'switch-confirmation') {
      expect(result.switch.needsRetry).toBe(true);
    }
  });

  it('confirmed + DB committed to B → activates B on boot', async () => {
    const staged = await stageAccountSwitchAttempt({
      sourceAccountId: userA.id,
      targetAccountId: userB.id,
      targetSessionId: '44444444-4444-4444-8444-444444444444',
      targetUserSnapshot: userB,
    });
    if (!staged.ok) {
      throw new Error('stage failed');
    }
    await confirmAccountSwitchAttempt(staged.value.attempt_id, {
      sourceAccountId: userA.id,
      targetAccountId: userB.id,
    });
    await saveSession({
      session_id: '44444444-4444-4444-8444-444444444444',
      access_token: 'lb_at_b',
      refresh_token: 'lb_rt_b',
      access_expires_at: sessionA.access_expires_at,
      refresh_expires_at: sessionA.refresh_expires_at,
      user_id: userB.id,
      stored_at: '2026-09-27T00:00:00.000Z',
    });
    const db = getDatabase();
    db.execute(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      ['current_account_id', userB.id, '2026-09-27T00:00:00.000Z'],
    );

    const result = await bootAccount({platform: 'android'});
    expect(result).toEqual({
      status: 'authenticated',
      user: expect.objectContaining({id: userB.id}),
    });
  });

  it('corrupt journal → switch-failed', async () => {
    const Keychain = jest.requireMock('react-native-keychain') as {
      setGenericPassword: jest.Mock;
    };
    await Keychain.setGenericPassword('account-switch-attempt', '{bad', {
      service: ACCOUNT_SWITCH_JOURNAL_SERVICE,
    });

    const result = await bootAccount({platform: 'android'});
    expect(result.status).toBe('switch-failed');
  });
});
