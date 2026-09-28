import {open} from 'react-native-quick-sqlite';
import {__resetMockDatabases} from '../../../../test-utils/sqliteMock';
import {DB_NAME} from '../../db/constants';
import {getDatabase, resetDatabaseForTests} from '../../db/database';
import {
  saveYouTubeProgress,
  getYouTubeProgress,
} from '../../db/YouTubeProgressRepository';
import * as DeviceIdentityNative from '../../identity/deviceIdentityNative';
import {
  bootAccount,
  cancelAccountSwitch,
  confirmAccountSwitch,
  resetBootStateForTests,
  submitOnboardingName,
} from '../accountBootstrap';
import {resetAccountSwitchCoordinatorForTests} from '../accountSwitchCoordinator';
import {resetRefreshStateForTests} from '../authSession';
import {getActiveSession, getActiveSessionId} from '../sessionStore';
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

const sessionB: AuthSession = {
  session_id: '44444444-4444-4444-8444-444444444444',
  access_token: 'lb_at_b',
  refresh_token: 'lb_rt_b',
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
  resetAccountSwitchCoordinatorForTests();
  mockFetch.mockReset();
  jest
    .spyOn(DeviceIdentityNative, 'readPlatformIdentifiers')
    .mockResolvedValue({
      androidId: 'android-id-1',
      identifierForVendor: null,
    });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('accountBootstrap P2 account switch (LING-109 / TASK-021)', () => {
  it('stages B without activating the candidate session pointer', async () => {
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
    saveYouTubeProgress({lessonId: 'keep-a', positionMs: 1, segmentIndex: 0});

    mockFetch.mockImplementation(async (url: string) => {
      if (url.endsWith('/v1/auth/bootstrap')) {
        return jsonResponse(200, {
          request_id: 'b1',
          status: 'authenticated',
          user: userB,
          session: sessionB,
        });
      }
      return jsonResponse(404, {});
    });

    const result = await bootAccount({platform: 'android'});
    expect(result.status).toBe('switch-confirmation');
    const active = await getActiveSessionId();
    expect(active.ok && active.value).not.toBe(sessionB.session_id);
    expect(getYouTubeProgress('keep-a')).not.toBeNull();
  });

  function ticketResponse() {
    return jsonResponse(404, {
      request_id: 't1',
      status: 'failed',
      error: {code: 'ACCOUNT_NOT_FOUND', message: 'No account.'},
      bootstrap_ticket: 'bt_ticket_1',
      bootstrap_ticket_expires_at: new Date(Date.now() + 900_000).toISOString(),
    });
  }

  function createdResponse(user: AuthUser, session: AuthSession) {
    return jsonResponse(201, {
      request_id: 'c1',
      status: 'created',
      user,
      session,
    });
  }

  it('cancel removes the candidate and preserves A learner rows', async () => {
    mockFetch.mockResolvedValueOnce(ticketResponse());
    await bootAccount({platform: 'android'});
    mockFetch.mockResolvedValueOnce(createdResponse(userA, sessionA));
    await submitOnboardingName({
      bootstrapTicket: 'bt_ticket_1',
      displayName: 'User A',
    });
    saveYouTubeProgress({lessonId: 'keep-a', positionMs: 1, segmentIndex: 0});

    mockFetch.mockResolvedValueOnce(createdResponse(userB, sessionB));
    const staged = await submitOnboardingName({
      bootstrapTicket: 'bt_ticket_2',
      displayName: 'User B',
    });
    if (staged.status !== 'switch-confirmation') {
      throw new Error('expected switch-confirmation');
    }

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

    const cancelled = await cancelAccountSwitch(staged.switch.attemptId);
    expect(cancelled.status).toBe('authenticated');
    expect(getYouTubeProgress('keep-a')).not.toBeNull();
    const stored = await getActiveSession();
    expect(stored.value?.user_id).toBe(userA.id);
  });

  it('confirm activates B only after the replacement transaction commits', async () => {
    mockFetch.mockResolvedValueOnce(ticketResponse());
    await bootAccount({platform: 'android'});
    mockFetch.mockResolvedValueOnce(createdResponse(userA, sessionA));
    await submitOnboardingName({
      bootstrapTicket: 'bt_ticket_1',
      displayName: 'User A',
    });
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
    saveYouTubeProgress({lessonId: 'gone', positionMs: 1, segmentIndex: 0});

    mockFetch.mockResolvedValueOnce(createdResponse(userB, sessionB));
    const staged = await submitOnboardingName({
      bootstrapTicket: 'bt_ticket_2',
      displayName: 'User B',
    });
    if (staged.status !== 'switch-confirmation') {
      throw new Error('expected switch-confirmation');
    }
    const confirmed = await confirmAccountSwitch(staged.switch.attemptId);
    expect(confirmed.status).toBe('authenticated');
    expect(confirmed.status === 'authenticated' && confirmed.user.id).toBe(
      userB.id,
    );
    const active = await getActiveSession();
    expect(active.value?.session_id).toBe(sessionB.session_id);
    expect(getYouTubeProgress('gone')).toBeNull();
  });
});
