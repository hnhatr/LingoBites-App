import {open} from 'react-native-quick-sqlite';
import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {DB_NAME} from '@shared/db/constants';
import {getDatabase, resetDatabaseForTests} from '@shared/db/database';
import {
  saveYouTubeProgress,
  getYouTubeProgress,
} from '@shared/db/YouTubeProgressRepository';
import * as DeviceIdentityNative from '@shared/identity/deviceIdentityNative';
import {
  bootAccount,
  confirmAccountSwitch,
  resetBootStateForTests,
  submitOnboardingName,
  SIGNUP_IDEMPOTENCY_KEY,
} from '../../accountBootstrap';
import {resetRefreshStateForTests} from '../../authSession';
import {clearAllSessions} from '../../sessionStore';
import {installKeychainVault, vault} from '@/test-support/keychainVault';
import type {AuthSession, AuthUser} from '../../authTypes';
import {CHARACTERIZATION_INVARIANTS} from '@/test-support/characterization';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const userA: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111',
  public_code: 'LB-AAAA1111',
  display_name: 'User A',
  phone_e164: null,
  status: 'active',
  created_at: '2026-09-27T00:00:00.000Z',
  updated_at: '2026-09-27T00:00:00.000Z',
};

const userB: AuthUser = {
  id: '22222222-2222-4222-8222-222222222222',
  public_code: 'LB-BBBB2222',
  display_name: 'User B',
  phone_e164: null,
  status: 'active',
  created_at: '2026-09-27T00:00:00.000Z',
  updated_at: '2026-09-27T00:00:00.000Z',
};

const freshSession: AuthSession = {
  session_id: '33333333-3333-4333-8333-333333333333',
  access_token: 'lb_at',
  refresh_token: 'lb_rt',
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

function ticketResponse() {
  return jsonResponse(404, {
    request_id: 't1',
    status: 'failed',
    error: {code: 'ACCOUNT_NOT_FOUND', message: 'No account.'},
    bootstrap_ticket: 'bt_ticket_1',
    bootstrap_ticket_expires_at: new Date(Date.now() + 900_000).toISOString(),
  });
}

function createdResponse(user: AuthUser) {
  return jsonResponse(201, {
    request_id: 'c1',
    status: 'created',
    user,
    session: freshSession,
  });
}

beforeEach(() => {
  __resetMockDatabases();
  resetDatabaseForTests(open({name: DB_NAME}));
  getDatabase();
  installKeychainVault();
  resetBootStateForTests();
  resetRefreshStateForTests();
  mockFetch.mockReset();
  jest
    .spyOn(DeviceIdentityNative, 'readPlatformIdentifiers')
    .mockResolvedValue({
      androidId: 'a1b2c3d4e5f60718',
      identifierForVendor: null,
    });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe(`${CHARACTERIZATION_INVARIANTS.INV_003} production account switch (HC-005)`, () => {
  it('submitOnboardingName cross-account stages confirmation then confirm wipes prior learner rows', async () => {
    mockFetch.mockResolvedValueOnce(ticketResponse());
    const ticket = await bootAccount({platform: 'android'});
    expect(ticket.status).toBe('needs-onboarding');

    mockFetch.mockResolvedValueOnce(createdResponse(userA));
    const onboarded = await submitOnboardingName({
      bootstrapTicket: 'bt_ticket_1',
      displayName: 'User A',
    });
    expect(onboarded.status).toBe('authenticated');

    saveYouTubeProgress({
      lessonId: 'lesson-account-a',
      positionMs: 1200,
      segmentIndex: 1,
    });
    expect(getYouTubeProgress('lesson-account-a')).not.toBeNull();

    await clearAllSessions();
    vault.clear();
    resetBootStateForTests();
    resetRefreshStateForTests();
    getDatabase().execute('DELETE FROM app_settings WHERE key = ?;', [
      SIGNUP_IDEMPOTENCY_KEY,
    ]);

    mockFetch.mockResolvedValueOnce(ticketResponse());
    const secondTicket = await bootAccount({platform: 'android'});
    expect(secondTicket.status).toBe('needs-onboarding');

    mockFetch.mockResolvedValueOnce(createdResponse(userB));
    const switched = await submitOnboardingName({
      bootstrapTicket: 'bt_ticket_1',
      displayName: 'User B',
    });
    expect(switched.status).toBe('switch-confirmation');
    expect(getYouTubeProgress('lesson-account-a')).not.toBeNull();

    if (switched.status !== 'switch-confirmation') {
      throw new Error('expected switch-confirmation');
    }
    const confirmed = await confirmAccountSwitch(switched.switch.attemptId);
    expect(confirmed.status).toBe('authenticated');
    if (confirmed.status === 'authenticated') {
      expect(confirmed.user.id).toBe(userB.id);
    }

    expect(getYouTubeProgress('lesson-account-a')).toBeNull();
  });
});
