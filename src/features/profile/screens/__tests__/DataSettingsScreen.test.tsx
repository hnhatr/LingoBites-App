import React from 'react';
import {Alert, Linking, Modal, Text} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import {TextField} from '@ui/components/TextField';
import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {DataSettingsScreen} from '../DataSettingsScreen';

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
} as unknown as React.ComponentProps<typeof DataSettingsScreen>['navigation'];

const route = {
  key: 'DataSettings',
  name: 'DataSettings',
  params: undefined,
} as React.ComponentProps<typeof DataSettingsScreen>['route'];

function renderScreen() {
  return ReactTestRenderer.create(
    <FeatureFlagProvider>
      <AppThemeProvider>
        <DataSettingsScreen navigation={navigation} route={route} />
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

function openClearLearningDataModal(root: ReactTestRenderer.ReactTestInstance) {
  const opener = findPressableByLabel(root, 'Xóa dữ liệu học trên máy');
  expect(opener?.props.onPress).toBeInstanceOf(Function);
  return opener as ReactTestRenderer.ReactTestInstance;
}

function clearDataModal(root: ReactTestRenderer.ReactTestInstance) {
  return root.findByType(Modal);
}

function clearDataConfirmField(root: ReactTestRenderer.ReactTestInstance) {
  return root.findByType(TextField);
}

function clearDataDeleteButton(root: ReactTestRenderer.ReactTestInstance) {
  return findPressableByLabel(root, 'Xóa');
}

describe('DataSettingsScreen', () => {
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

  it('shows speaking recordings settings in Cài đặt', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });

    expect(
      tree!.root.findAll(
        node => node.props.testID === 'speaking-recordings-settings',
      ).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('explains there is no cached audio when tapping the chapter audio row (VC-4)', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
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
      tree = renderScreen();
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

  it('keeps confirm text when Android back dismisses the clear-data modal (CR-001)', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });

    await ReactTestRenderer.act(async () => {
      openClearLearningDataModal(tree!.root)?.props.onPress();
    });
    expect(clearDataModal(tree!.root).props.visible).toBe(true);

    await ReactTestRenderer.act(async () => {
      clearDataConfirmField(tree!.root).props.onChangeText('XOA');
    });

    await ReactTestRenderer.act(async () => {
      clearDataModal(tree!.root).props.onRequestClose();
    });
    expect(clearDataModal(tree!.root).props.visible).toBe(false);

    await ReactTestRenderer.act(async () => {
      openClearLearningDataModal(tree!.root)?.props.onPress();
    });
    expect(clearDataConfirmField(tree!.root).props.value).toBe('XOA');
    expect(clearDataDeleteButton(tree!.root)?.props.disabled).not.toBe(true);
  });

  it('clears confirm text when canceling the clear-data modal (CR-001 / Hủy)', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });

    await ReactTestRenderer.act(async () => {
      openClearLearningDataModal(tree!.root)?.props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      clearDataConfirmField(tree!.root).props.onChangeText('XOA');
    });

    await ReactTestRenderer.act(async () => {
      findPressableByLabel(tree!.root, 'Hủy')?.props.onPress();
    });
    expect(clearDataModal(tree!.root).props.visible).toBe(false);

    await ReactTestRenderer.act(async () => {
      openClearLearningDataModal(tree!.root)?.props.onPress();
    });
    expect(clearDataConfirmField(tree!.root).props.value).toBe('');
    expect(clearDataDeleteButton(tree!.root)?.props.disabled).toBe(true);
  });
});
