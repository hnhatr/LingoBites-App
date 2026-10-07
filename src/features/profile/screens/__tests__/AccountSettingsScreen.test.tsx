import React from 'react';
import {Alert, Text} from 'react-native';
import * as Keychain from 'react-native-keychain';
import {open} from 'react-native-quick-sqlite';
import ReactTestRenderer from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {resetRefreshStateForTests} from '@core/auth/authSession';
import {getActiveSession} from '@core/auth/sessionStore';
import {DB_NAME} from '@core/db/constants';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import * as DeviceIdentityNative from '@core/identity/deviceIdentityNative';
import {FeatureFlagProvider} from '@core/release';

import {installKeychainVault} from '@test/support/keychainVault';

import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {resetBootStateForTests} from '../../../account/logic/accountBootstrap';
import {
  resetAccountStoreForTests,
  useAccountStore,
} from '../../../account/logic/useAccountStore';
import {AccountSettingsScreen} from '../AccountSettingsScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockClearAllLocalDataWithFiles = jest.fn(async () => ({
  ok: true,
  dbCleared: true,
  failedFilePaths: [],
}));
const mockClearSpeakingLocalData = jest.fn(async () => ({
  ok: true,
  dbCleared: true,
  failedFilePaths: [],
}));

jest.mock('@core/localData', () => ({
  clearAllLocalDataWithFiles: () => mockClearAllLocalDataWithFiles(),
  clearSpeakingLocalData: () => mockClearSpeakingLocalData(),
}));

jest.mock('@core/api/appConfig', () => ({
  getSupportEmail: () => 'support@lingobites.app',
  getAppConfig: () => ({apiBaseUrl: 'https://test.lingobites.app'}),
}));

const navigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
} as unknown as React.ComponentProps<
  typeof AccountSettingsScreen
>['navigation'];

const route = {
  key: 'AccountSettings',
  name: 'AccountSettings',
  params: undefined,
} as React.ComponentProps<typeof AccountSettingsScreen>['route'];

function renderScreen() {
  return ReactTestRenderer.create(
    <FeatureFlagProvider>
      <AppThemeProvider>
        <AccountSettingsScreen navigation={navigation} route={route} />
      </AppThemeProvider>
    </FeatureFlagProvider>,
  );
}

function findPressableByLabel(
  root: ReactTestRenderer.ReactTestInstance,
  label: string,
) {
  const textNode = root
    .findAllByType(Text)
    .find(node => node.props.children === label);

  let current = textNode?.parent;
  while (current && typeof current.props.onPress !== 'function') {
    current = current.parent;
  }

  return current;
}

describe('AccountSettingsScreen (sync + TASK-006 confirmed sign-out)', () => {
  const mockFetch = jest.fn();

  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    public_code: 'LB-AB12CD34',
    display_name: 'An',
    phone_e164: null,
    status: 'active',
    created_at: '2026-09-14T00:00:00.000Z',
    updated_at: '2026-09-14T00:00:00.000Z',
  };

  const freshSession = {
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

  function loggedOutResponse() {
    return jsonResponse(200, {
      request_id: 'l1',
      status: 'logged_out',
      revoked: true,
    });
  }

  async function bootToAuthenticated() {
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
  }

  function logoutFetchCount() {
    return mockFetch.mock.calls.filter(([url]) =>
      String(url).includes('/v1/auth/logout'),
    ).length;
  }

  type AlertButton = {text: string; style?: string; onPress?: () => void};

  function alertButtons(): AlertButton[] {
    const calls = (Alert.alert as jest.Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    return calls[calls.length - 1][2] as AlertButton[];
  }

  function confirmButton(): AlertButton {
    const confirm = alertButtons().find(
      button => button.style === 'destructive',
    );
    expect(confirm?.onPress).toBeInstanceOf(Function);
    return confirm as AlertButton;
  }

  beforeEach(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
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
      .mockResolvedValue({
        androidId: 'a1b2c3d4e5f60718',
        identifierForVendor: null,
      });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('hides the logout action while not authenticated', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });

    expect(JSON.stringify(tree!.toJSON())).not.toContain('Đăng xuất');
  });

  it('shows the sync row only while authenticated (F6)', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });
    expect(JSON.stringify(tree!.toJSON())).not.toContain('Đồng bộ ngay');

    await bootToAuthenticated();
    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });
    const text = JSON.stringify(tree!.toJSON());
    expect(text).toContain('Đồng bộ ngay');
    expect(text).toContain('Lần cuối: Chưa đồng bộ');
  });

  it('shows the logout action while authenticated', async () => {
    await bootToAuthenticated();
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });

    expect(JSON.stringify(tree!.toJSON())).toContain('Đăng xuất');
    expect(findPressableByLabel(tree!.root, 'Đăng xuất')).toBeTruthy();
  });

  it('cancelling confirmation changes nothing', async () => {
    await bootToAuthenticated();
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });

    await ReactTestRenderer.act(async () => {
      findPressableByLabel(tree!.root, 'Đăng xuất')?.props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Đăng xuất?',
      expect.stringContaining('thiết bị này'),
      expect.any(Array),
    );
    expect(logoutFetchCount()).toBe(0);
    expect(useAccountStore.getState().phase).toBe('authenticated');
    await expect(getActiveSession()).resolves.toMatchObject({ok: true});
  });

  it('confirming signs out once through the store and clears the session', async () => {
    await bootToAuthenticated();
    mockFetch.mockResolvedValueOnce(loggedOutResponse());
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });

    await ReactTestRenderer.act(async () => {
      findPressableByLabel(tree!.root, 'Đăng xuất')?.props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      confirmButton().onPress?.();
    });

    expect(logoutFetchCount()).toBe(1);
    expect(useAccountStore.getState().phase).toBe('signed-out');
    await expect(getActiveSession()).resolves.toEqual({
      ok: true,
      value: null,
    });
  });

  it('sends at most one operation on repeated confirms', async () => {
    await bootToAuthenticated();
    let resolveLogout!: (value: unknown) => void;
    mockFetch.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveLogout = resolve;
        }),
    );
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });

    await ReactTestRenderer.act(async () => {
      findPressableByLabel(tree!.root, 'Đăng xuất')?.props.onPress();
    });
    const confirm = confirmButton();
    await ReactTestRenderer.act(async () => {
      confirm.onPress?.();
      confirm.onPress?.();
    });
    await ReactTestRenderer.act(async () => {
      resolveLogout(loggedOutResponse());
    });

    expect(logoutFetchCount()).toBe(1);
    expect(useAccountStore.getState().phase).toBe('signed-out');
  });

  it('disables the row while logout is pending', async () => {
    await bootToAuthenticated();
    let resolveLogout!: (value: unknown) => void;
    mockFetch.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveLogout = resolve;
        }),
    );
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });

    await ReactTestRenderer.act(async () => {
      findPressableByLabel(tree!.root, 'Đăng xuất')?.props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      confirmButton().onPress?.();
    });

    expect(findPressableByLabel(tree!.root, 'Đăng xuất')?.props.disabled).toBe(
      true,
    );
    await ReactTestRenderer.act(async () => {
      resolveLogout(loggedOutResponse());
    });
    expect(useAccountStore.getState().phase).toBe('signed-out');
  });

  it('shows a localized failure and stays put when secure storage fails', async () => {
    await bootToAuthenticated();
    mockFetch.mockResolvedValueOnce(loggedOutResponse());
    (Keychain.resetGenericPassword as jest.Mock).mockRejectedValueOnce(
      new Error('keychain locked'),
    );
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });

    await ReactTestRenderer.act(async () => {
      findPressableByLabel(tree!.root, 'Đăng xuất')?.props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      confirmButton().onPress?.();
    });

    expect(useAccountStore.getState().phase).toBe('authenticated');
    expect(JSON.stringify(tree!.toJSON())).toContain('Chưa thể đăng xuất');
    await expect(getActiveSession()).resolves.toMatchObject({ok: true});
  });

  it('shows the account form while authenticated', async () => {
    await bootToAuthenticated();
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });
    const text = JSON.stringify(tree!.toJSON());
    expect(text).toContain('LB-AB12CD34');
    expect(text).toContain('Lưu');
  });
});
