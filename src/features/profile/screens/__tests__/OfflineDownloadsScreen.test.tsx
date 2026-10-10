import React from 'react';
import {Alert} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {OfflineStudySettingsGroup} from '../../components/OfflineStudySettingsGroup';
import {OfflineDownloadsScreen} from '../OfflineDownloadsScreen';

let mockConsent = 'undecided';
let mockDownloads: Array<{lessonId: string; title: string; mediaDir: string}> =
  [];
const mockSetConsent = jest.fn((value: string) => {
  mockConsent = value;
});
const mockRemoveOne = jest.fn((lessonId: string) => {
  mockDownloads = mockDownloads.filter(entry => entry.lessonId !== lessonId);
});
const mockRemoveAll = jest.fn(() => {
  mockDownloads = [];
});

jest.mock('@features/lesson/player', () => ({
  readMediaDownloadConsent: () => mockConsent,
  setMediaDownloadConsent: (value: string) => mockSetConsent(value),
  listLessonMediaDownloads: () => mockDownloads,
  lessonMediaSizeBytes: async () => 2 * 1024 * 1024,
  removeLessonMedia: (lessonId: string) => mockRemoveOne(lessonId),
  removeAllLessonMedia: () => mockRemoveAll(),
  sweepLessonMedia: async () => ({removed: []}),
}));

const navigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
} as unknown as React.ComponentProps<
  typeof OfflineDownloadsScreen
>['navigation'];

async function render(element: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>{element}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

const text = (tree: ReactTestRenderer.ReactTestRenderer) =>
  JSON.stringify(tree.toJSON());

function pressAlertButton(label: string) {
  const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] as Array<{
    text: string;
    onPress?: () => void;
  }>;
  buttons.find(button => button.text === label)?.onPress?.();
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockConsent = 'undecided';
  mockDownloads = [
    {lessonId: 'a', title: 'Morning routine', mediaDir: 'lesson-media/a/3'},
    {lessonId: 'b', title: 'At the office', mediaDir: 'lesson-media/b/1'},
  ];
});

describe('OfflineStudySettingsGroup', () => {
  it('explains what is stored and shows the choice and stored media', async () => {
    const tree = await render(
      <OfflineStudySettingsGroup onOpenDownloads={jest.fn()} />,
    );
    expect(text(tree)).toContain('Học offline');
    expect(text(tree)).toContain('Chưa chọn');
    expect(text(tree)).toContain('4.0 MB · 2 bài');
    expect(text(tree)).toContain('luôn');
    expect(text(tree)).toContain('chỉ tải khi bạn cho phép');
  });

  it('changes the media download choice', async () => {
    const tree = await render(
      <OfflineStudySettingsGroup onOpenDownloads={jest.fn()} />,
    );
    const row = tree.root.findAll(
      node =>
        node.props.accessibilityLabel ===
          'Tải ảnh và âm thanh bài học: Chưa chọn' &&
        typeof node.props.onPress === 'function',
    )[0];
    act(() => row.props.onPress());
    const option = tree.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Tự động tải' &&
        typeof node.props.onPress === 'function',
    )[0];
    act(() => option.props.onPress());
    expect(mockSetConsent).toHaveBeenCalledWith('auto');
    expect(text(tree)).toContain('Tự động');
  });
});

describe('OfflineDownloadsScreen', () => {
  it('lists each lesson with its size', async () => {
    const tree = await render(
      <OfflineDownloadsScreen
        navigation={navigation}
        route={{key: 'k', name: 'OfflineDownloads', params: undefined}}
      />,
    );
    expect(text(tree)).toContain('Morning routine');
    expect(text(tree)).toContain('At the office');
    expect(text(tree)).toContain('2 bài · 4.0 MB');
  });

  it('deletes one lesson media after confirmation', async () => {
    const tree = await render(
      <OfflineDownloadsScreen
        navigation={navigation}
        route={{key: 'k', name: 'OfflineDownloads', params: undefined}}
      />,
    );
    const row = tree.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Morning routine, 2.0 MB' &&
        typeof node.props.onPress === 'function',
    )[0];
    act(() => row.props.onPress());
    expect(mockRemoveOne).not.toHaveBeenCalled();
    await act(async () => {
      pressAlertButton('Xoá');
    });
    expect(mockRemoveOne).toHaveBeenCalledWith('a');
    expect(text(tree)).not.toContain('Morning routine');
  });

  it('deletes all media and shows the empty state', async () => {
    const tree = await render(
      <OfflineDownloadsScreen
        navigation={navigation}
        route={{key: 'k', name: 'OfflineDownloads', params: undefined}}
      />,
    );
    act(() => {
      tree.root
        .findAll(
          node =>
            node.props.testID === 'offline-downloads-remove-all' &&
            typeof node.props.onPress === 'function',
        )[0]
        .props.onPress();
    });
    await act(async () => {
      pressAlertButton('Xoá tất cả');
    });
    expect(mockRemoveAll).toHaveBeenCalledTimes(1);
    expect(
      tree.root.findAll(node => node.props.testID === 'offline-downloads-empty')
        .length,
    ).toBeGreaterThan(0);
  });
});
