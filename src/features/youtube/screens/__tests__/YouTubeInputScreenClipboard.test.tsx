import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {YouTubeInputScreen} from '../YouTubeInputScreen';

// Simulate a binary built before `pod install`: evaluating the native
// clipboard module throws (RNCClipboard TurboModule missing). The screen
// must still render and degrade only the paste action.
jest.mock('@react-native-clipboard/clipboard', () => {
  throw new Error(
    "TurboModuleRegistry.getEnforcing(...): 'RNCClipboard' could not be found.",
  );
});

const navigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
} as unknown as React.ComponentProps<typeof YouTubeInputScreen>['navigation'];

const route = {
  key: 'YouTubeInput',
  name: 'YouTubeInput',
  params: undefined,
} as React.ComponentProps<typeof YouTubeInputScreen>['route'];

function renderScreen() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <YouTubeInputScreen navigation={navigation} route={route} />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

describe('YouTubeInputScreen without native clipboard module', () => {
  it('renders without crashing', () => {
    const tree = renderScreen();
    expect(tree.root.findByProps({testID: 'youtube-url-input'})).toBeTruthy();
  });

  it('shows an unavailable message instead of crashing on paste', async () => {
    const tree = renderScreen();

    await act(async () => {
      tree.root.findByProps({testID: 'youtube-paste-url'}).props.onPress();
      await Promise.resolve();
    });

    expect(
      tree.root.findByProps({testID: 'youtube-url-input'}).props.errorMessage,
    ).toBe(
      'Bộ nhớ tạm chưa dùng được ở bản build này. Hãy nhấn giữ ô nhập để dán thủ công.',
    );
  });
});
