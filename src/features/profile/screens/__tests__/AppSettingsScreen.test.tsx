import React from 'react';
import {Alert, Linking} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {makeTestReleaseConfig, OFFLINE_REVIEW_MVP} from '@test/support';

import {AppSettingsScreen} from '../AppSettingsScreen';

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
} as unknown as React.ComponentProps<typeof AppSettingsScreen>['navigation'];

const route = {
  key: 'AppSettings',
  name: 'AppSettings',
  params: undefined,
} as React.ComponentProps<typeof AppSettingsScreen>['route'];

function renderScreen() {
  return ReactTestRenderer.create(
    <FeatureFlagProvider>
      <AppThemeProvider>
        <AppSettingsScreen navigation={navigation} route={route} />
      </AppThemeProvider>
    </FeatureFlagProvider>,
  );
}

describe('AppSettingsScreen', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGoBack.mockReset();
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

  it('shows the theme picker when themeSwitcher is enabled', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });
    expect(JSON.stringify(tree!.toJSON())).toContain('Giao diện');
  });

  it('hides the theme picker when themeSwitcher is disabled', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <FeatureFlagProvider
          releaseConfig={makeTestReleaseConfig(OFFLINE_REVIEW_MVP)}
        >
          <AppThemeProvider>
            <AppSettingsScreen navigation={navigation} route={route} />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });
    expect(JSON.stringify(tree!.toJSON())).not.toContain('Giao diện');
  });
});
