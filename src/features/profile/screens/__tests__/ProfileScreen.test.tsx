import React from 'react';
import {Alert, Linking, Text} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import {getReminderSettings, getWeeklyGoalTarget} from '@features/engagement';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {makeTestReleaseConfig, OFFLINE_REVIEW_MVP} from '@test/support';

import {
  resetAccountStoreForTests,
  useAccountStore,
} from '../../../account/logic/useAccountStore';
import {ProfileScreen} from '../ProfileScreen';

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

const mockGetCapabilityProgressReport = jest.fn(() => ({
  firstListenComprehensionRate: null,
}));

jest.mock('../../logic/useProgressReport', () => ({
  useProgressReport: () => ({
    getCapabilityProgressReport: mockGetCapabilityProgressReport,
  }),
}));

const navigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
} as unknown as React.ComponentProps<typeof ProfileScreen>['navigation'];

const route = {
  key: 'ProfileMain',
  name: 'ProfileMain',
  params: undefined,
} as React.ComponentProps<typeof ProfileScreen>['route'];

function renderScreen() {
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
    mockGoBack.mockReset();
    resetAccountStoreForTests();
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
      tree = renderScreen();
    });

    const text = JSON.stringify(tree!.toJSON());
    expect(text).toContain('Beginner');
    expect(text).toContain('Chưa có chuỗi ngày');
  });

  it('does not show fake profile metrics or the dead edit affordance', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });

    const text = JSON.stringify(tree!.toJSON());
    expect(text).not.toContain('4.2k');
    expect(text).not.toContain('"85%"');
    expect(text).toContain('—');
    expect(text).not.toContain('Chỉnh sửa hồ sơ');
  });

  it('shows only settings that work, with real values (F6)', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });

    const text = JSON.stringify(tree!.toJSON());
    expect(text).not.toContain('Chưa đặt');
    expect(text).not.toContain('Ngôn ngữ app');
    expect(text).not.toContain('Dịch sang');
    expect(text).not.toContain('Cây ảo');
    expect(text).toContain('Mục tiêu tuần');
    expect(text).toContain('6 bài/tuần');
    expect(text).toContain('Nhắc nhở');
    expect(text).toContain('Giờ vàng');
    expect(findPressableByLabel(tree!.root, 'Mục tiêu tuần')).toBeTruthy();
    expect(findPressableByLabel(tree!.root, 'Nhắc nhở')).toBeTruthy();
  });

  it('saves the weekly goal picked from the sheet (F6)', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });

    await ReactTestRenderer.act(async () => {
      findPressableByLabel(tree!.root, 'Mục tiêu tuần')!.props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      findPressableByLabel(tree!.root, '3 bài/tuần')!.props.onPress();
    });

    expect(JSON.stringify(tree!.toJSON())).toContain('3 bài/tuần');
    expect(getWeeklyGoalTarget()).toBe(3);
  });

  it('turns reminders off from the sheet (F6)', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });

    await ReactTestRenderer.act(async () => {
      findPressableByLabel(tree!.root, 'Nhắc nhở')!.props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      findPressableByLabel(tree!.root, 'Tắt nhắc nhở')!.props.onPress();
    });

    expect(getReminderSettings()).toEqual({enabled: false, dailyTime: null});
    expect(JSON.stringify(tree!.toJSON())).toContain('"Tắt"');
  });

  it('groups navigation rows and opens each page', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });

    const text = JSON.stringify(tree!.toJSON());
    expect(text).toContain('Học tập');
    expect(text).not.toContain('Vùng nguy hiểm');
    expect(text).not.toContain('Xóa dữ liệu học trên máy');
    expect(text).not.toContain('Đăng xuất');

    for (const [label, routeName] of [
      ['Dữ liệu & bộ nhớ', 'DataSettings'],
      ['Cài đặt ứng dụng', 'AppSettings'],
      ['Hỗ trợ & thông tin', 'SupportAbout'],
    ] as const) {
      await ReactTestRenderer.act(async () => {
        findPressableByLabel(tree!.root, label)?.props.onPress();
      });
      expect(mockNavigate).toHaveBeenLastCalledWith(routeName);
    }
  });

  it('hides the account row until authenticated, then opens Tài khoản', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });
    expect(findPressableByLabel(tree!.root, 'Tài khoản')).toBeUndefined();

    useAccountStore.setState({
      phase: 'authenticated',
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        public_code: 'LB-AB12CD34',
        display_name: 'An',
        phone_e164: null,
        status: 'active',
        created_at: '2026-09-14T00:00:00.000Z',
        updated_at: '2026-09-14T00:00:00.000Z',
      },
    });
    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });
    await ReactTestRenderer.act(async () => {
      findPressableByLabel(tree!.root, 'Tài khoản')?.props.onPress();
    });
    expect(mockNavigate).toHaveBeenLastCalledWith('AccountSettings');
  });

  it('hides app settings when themeSwitcher is disabled', async () => {
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
    expect(JSON.stringify(tree!.toJSON())).not.toContain('Cài đặt ứng dụng');
  });
});
