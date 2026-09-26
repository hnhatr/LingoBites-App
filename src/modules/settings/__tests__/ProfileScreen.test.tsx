import React from 'react';
import {Alert, Linking, Text} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import {open} from 'react-native-quick-sqlite';
import * as Keychain from 'react-native-keychain';
import {FeatureFlagProvider} from '@/release';
import {makeTestReleaseConfig, OFFLINE_REVIEW_MVP} from '@/test-support';
import {AppThemeProvider} from '@theme';
import {__resetMockDatabases} from '../../../../test-utils/sqliteMock';
import {DB_NAME} from '../../../shared/db/constants';
import {getDatabase, resetDatabaseForTests} from '../../../shared/db/database';
import * as DeviceIdentityNative from '../../../shared/identity/deviceIdentityNative';
import {resetBootStateForTests} from '../../../shared/auth/accountBootstrap';
import {resetRefreshStateForTests} from '../../../shared/auth/authSession';
import {getActiveSession} from '../../../shared/auth/sessionStore';
import {installKeychainVault} from '../../../test-support/keychainVault';
import {
  resetAccountStoreForTests,
  useAccountStore,
} from '../../account/useAccountStore';
import {ProfileScreen} from '../ProfileScreen';

const mockNavigate = jest.fn();
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

jest.mock('@shared/localData', () => ({
  clearAllLocalDataWithFiles: () => mockClearAllLocalDataWithFiles(),
  clearSpeakingLocalData: () => mockClearSpeakingLocalData(),
}));

jest.mock('@shared/api/appConfig', () => ({
  getSupportEmail: () => 'support@lingobites.app',
  getAppConfig: () => ({apiBaseUrl: 'https://test.lingobites.app'}),
}));

const mockGetCapabilityProgressReport = jest.fn(() => ({
  firstListenComprehensionRate: null,
}));

jest.mock('../useProgressReport', () => ({
  useProgressReport: () => ({
    getCapabilityProgressReport: mockGetCapabilityProgressReport,
  }),
}));


const navigation = {
  navigate: mockNavigate,
} as unknown as React.ComponentProps<typeof ProfileScreen>['navigation'];

const route = {
  key: 'ProfileMain',
  name: 'ProfileMain',
  params: undefined,
} as React.ComponentProps<typeof ProfileScreen>['route'];

function renderProfileScreen() {
  return ReactTestRenderer.create(
    <FeatureFlagProvider>
      <AppThemeProvider>
        <ProfileScreen navigation={navigation} route={route} />
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

describe('ProfileScreen', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockClearAllLocalDataWithFiles.mockReset();
    mockClearSpeakingLocalData.mockReset();
    mockClearAllLocalDataWithFiles.mockResolvedValue({
      ok: true,
      dbCleared: true,
      failedFilePaths: [],
    });
    mockClearSpeakingLocalData.mockResolvedValue({
      ok: true,
      dbCleared: true,
      failedFilePaths: [],
    });
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows default Beginner level (TC-022)', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = renderProfileScreen();
    });

    const text = JSON.stringify(tree!.toJSON());
    expect(text).toContain('Beginner');
    expect(text).toContain('Chưa có chuỗi ngày');
  });

  it('does not show fake profile metrics or the dead edit affordance', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = renderProfileScreen();
    });

    const text = JSON.stringify(tree!.toJSON());
    expect(text).not.toContain('4.2k');
    expect(text).not.toContain('"85%"');
    expect(text).toContain('—');
    expect(text).not.toContain('Chỉnh sửa hồ sơ');
  });

  it('shows Chưa đặt for settings without values instead of fake values or chevrons', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = renderProfileScreen();
    });

    const text = JSON.stringify(tree!.toJSON());
    expect(text).not.toContain('10 từ');
    expect(text).not.toContain('Tiếng Việt');
    expect(text).not.toContain('Incomplete');
    expect(text.match(/Chưa đặt/g)?.length).toBe(4);
  });

  it('shows developer entries in dev builds', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = renderProfileScreen();
    });

    const text = JSON.stringify(tree!.toJSON());
    expect(text).toContain('Tính năng hệ thống');
    expect(text).toContain('Demo native TTS');
    expect(text).toContain('Unified Lessons (Preview)');
  });

  it('hides developer entries on production builds', async () => {
    const originalDev = (globalThis as {__DEV__?: boolean}).__DEV__;
    (globalThis as {__DEV__?: boolean}).__DEV__ = false;
    try {
      let tree!: ReactTestRenderer.ReactTestRenderer;

      await ReactTestRenderer.act(async () => {
        tree = renderProfileScreen();
      });

      const text = JSON.stringify(tree!.toJSON());
      expect(text).not.toContain('Tính năng hệ thống');
      expect(text).not.toContain('Demo native TTS');
      expect(text).not.toContain('Unified Lessons (Preview)');
      expect(text).not.toContain('FeatureStatus');
      expect(text).not.toContain('TtsSpike');
      expect(text).not.toContain('UnifiedLessonsPreview');
    } finally {
      (globalThis as {__DEV__?: boolean}).__DEV__ = originalDev;
    }
  });

  it('hides the theme picker card when themeSwitcher is disabled', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <FeatureFlagProvider
          releaseConfig={makeTestReleaseConfig(OFFLINE_REVIEW_MVP)}
        >
          <AppThemeProvider>
            <ProfileScreen navigation={navigation} route={route} />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });

    const text = JSON.stringify(tree!.toJSON());
    expect(text).not.toContain('Giao diện');
  });

  it('opens privacy detail screen (FR-SET-004)', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = renderProfileScreen();
    });

    const privacyLink = findPressableByLabel(tree!.root, 'Quyền riêng tư');

    await ReactTestRenderer.act(async () => {
      privacyLink?.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('PrivacyNote');
  });

  it('opens support mailto from help row', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = renderProfileScreen();
    });

    const supportLink = findPressableByLabel(tree!.root, 'Trợ giúp & góp ý');

    await ReactTestRenderer.act(async () => {
      supportLink?.props.onPress();
    });

    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining('mailto:support@lingobites.app'),
    );
  });

  it('explains there is no cached audio when tapping the chapter audio row (VC-4)', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = renderProfileScreen();
    });

    const audioRow = findPressableByLabel(tree!.root, 'Âm thanh chương học');

    await ReactTestRenderer.act(async () => {
      await audioRow?.props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Âm thanh chương học',
      expect.stringContaining('Chưa có âm thanh'),
    );
  });

  it('triggers confirmation when tapping delete speaking data button (CHANGE-S3)', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = renderProfileScreen();
    });

    const deleteSpeakingBtn = findPressableByLabel(
      tree!.root,
      'Xóa dữ liệu luyện nói & ghi âm',
    );

    await ReactTestRenderer.act(async () => {
      deleteSpeakingBtn?.props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Xóa dữ liệu luyện nói',
      expect.stringContaining('bản ghi âm'),
      expect.any(Array),
    );
  });
});

describe('ProfileScreen logout (TASK-006 confirmed sign-out)', () => {
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
      tree = renderProfileScreen();
    });

    expect(JSON.stringify(tree!.toJSON())).not.toContain('Đăng xuất');
  });

  it('shows the logout action while authenticated', async () => {
    await bootToAuthenticated();
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderProfileScreen();
    });

    expect(JSON.stringify(tree!.toJSON())).toContain('Đăng xuất');
    expect(findPressableByLabel(tree!.root, 'Đăng xuất')).toBeTruthy();
  });

  it('cancelling confirmation changes nothing', async () => {
    await bootToAuthenticated();
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderProfileScreen();
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
      tree = renderProfileScreen();
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
      tree = renderProfileScreen();
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
      tree = renderProfileScreen();
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
      tree = renderProfileScreen();
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
});
