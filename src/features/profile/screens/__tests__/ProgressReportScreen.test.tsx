import React from 'react';
import {Alert, Text} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {clearAllLocalDatabaseRows} from '@core/db/localDataWipe';
import {FeatureFlagProvider} from '@core/release';

import {ProgressReportScreen} from '../ProgressReportScreen';

const mockGoBack = jest.fn();

const navigation = {
  goBack: mockGoBack,
  navigate: jest.fn(),
} as unknown as React.ComponentProps<typeof ProgressReportScreen>['navigation'];

const route = {
  key: 'ProgressReport-key',
  name: 'ProgressReport',
  params: undefined,
} as React.ComponentProps<typeof ProgressReportScreen>['route'];

function renderScreen() {
  return ReactTestRenderer.create(
    <FeatureFlagProvider>
      <AppThemeProvider>
        <ProgressReportScreen navigation={navigation} route={route} />
      </AppThemeProvider>
    </FeatureFlagProvider>,
  );
}

function findPressableByText(
  root: ReactTestRenderer.ReactTestInstance,
  textLabel: string,
) {
  const textNodes = root.findAllByType(Text);
  const textNode = textNodes.find(node => {
    const children = node.props.children;
    if (typeof children === 'string') return children.includes(textLabel);
    if (Array.isArray(children)) return children.join('').includes(textLabel);
    return false;
  });

  let current = textNode?.parent;
  while (current && typeof current.props.onPress !== 'function') {
    current = current.parent;
  }

  return current;
}

describe('ProgressReportScreen (REQ-39)', () => {
  beforeEach(() => {
    clearAllLocalDatabaseRows();
    mockGoBack.mockReset();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders capability progress report screen and metric sections', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });

    const text = JSON.stringify(tree!.toJSON());
    expect(text).toContain('Báo cáo tiến độ & Năng lực');
    expect(text).toContain('Nói không nhìn chữ');
    expect(text).toContain('Thời gian bắt đầu nói');
    expect(text).toContain('Hiểu ngay lần nghe đầu');
    expect(text).toContain('Ghi nhớ thẻ ôn');
    expect(text).toContain('Tình huống đã đạt');
    expect(text).toContain('Chỉ số sẽ hiện dần khi bạn học');
    expect(text).toContain('Chưa đủ dữ liệu');
    expect(text).not.toContain('(Situations)');
    expect(text).not.toContain('REQ-39');
    expect(text).toContain('Ghi âm trước & sau');
  });

  test('clicking export metrics button generates JSON output', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });

    const exportBtn = findPressableByText(
      tree!.root,
      'Xuất chỉ số (JSON ẩn danh)',
    );
    expect(exportBtn).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      exportBtn?.props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Xuất chỉ số học tập',
      expect.stringContaining('JSON ẩn danh'),
    );

    const updatedText = JSON.stringify(tree!.toJSON());
    expect(updatedText).toContain('lingobites-pilot-metrics-v1');
  });
});
