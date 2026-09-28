import React from 'react';
import {ActivityIndicator} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import {open} from 'react-native-quick-sqlite';
import {FeatureFlagProvider} from '@core/release/index';
import {AppThemeProvider} from '@ui/theme/index';
import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {DB_NAME} from '@core/db/constants';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import * as DeviceIdentityNative from '@core/identity/deviceIdentityNative';
import {resetBootStateForTests} from '../../logic/accountBootstrap';
import {resetRefreshStateForTests} from '@core/auth/authSession';
import {installKeychainVault} from '../../../../test-support/keychainVault';
import {
  resetAccountStoreForTests,
  useAccountStore,
} from '../../logic/useAccountStore';
import {BootGateScreen} from '../BootGateScreen';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const ANDROID_ID = 'a1b2c3d4e5f60718';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

function renderScreen() {
  return ReactTestRenderer.create(
    <FeatureFlagProvider>
      <AppThemeProvider>
        <BootGateScreen />
      </AppThemeProvider>
    </FeatureFlagProvider>,
  );
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

describe('BootGateScreen signed-out gate (TASK-005)', () => {
  it('shows signed-out copy with Continue, no spinner, and no auto-boot', async () => {
    useAccountStore.setState({
      phase: 'signed-out',
      user: null,
      bootstrapTicket: null,
      bootstrapTicketExpiresAt: null,
      failureCode: null,
      failureMessage: null,
    });
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });

    expect(tree.root.findAllByType(ActivityIndicator)).toEqual([]);
    expect(JSON.stringify(tree.toJSON())).toContain('Bạn đã đăng xuất');
    tree.root.findByProps({title: 'Tiếp tục'});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('runs one existing retry/boot attempt when Continue is pressed', async () => {
    useAccountStore.setState({
      phase: 'signed-out',
      user: null,
      bootstrapTicket: null,
      bootstrapTicketExpiresAt: null,
      failureCode: null,
      failureMessage: null,
    });
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        request_id: 'b1',
        status: 'authenticated',
        user: {
          id: '11111111-1111-4111-8111-111111111111',
          public_code: 'LB-AB12CD34',
          display_name: 'An',
          phone_e164: null,
          status: 'active',
          created_at: '2026-09-14T00:00:00.000Z',
          updated_at: '2026-09-14T00:00:00.000Z',
        },
        session: {
          session_id: '22222222-2222-4222-8222-222222222222',
          access_token: 'lb_at_access',
          refresh_token: 'lb_rt_refresh',
          access_expires_at: new Date(Date.now() + 3600_000).toISOString(),
          refresh_expires_at: new Date(
            Date.now() + 7 * 86400_000,
          ).toISOString(),
        },
      }),
    );
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });
    expect(mockFetch).not.toHaveBeenCalled();

    const cont = tree.root.findByProps({title: 'Tiếp tục'});
    await ReactTestRenderer.act(async () => {
      cont.props.onPress();
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0][0])).toContain('/v1/auth/bootstrap');
    expect(useAccountStore.getState().phase).toBe('authenticated');
  });

  it('still renders a spinner while bootstrapping', async () => {
    useAccountStore.setState({phase: 'bootstrapping'});
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });

    expect(tree.root.findAllByType(ActivityIndicator).length).toBe(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
