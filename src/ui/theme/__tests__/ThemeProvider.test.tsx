import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import {Text, useColorScheme} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {FeatureFlagProvider} from '@core/release';

import {
  CORE_BETA_WITHOUT_REVIEW,
  makeTestReleaseConfig,
  THEME_UI_FLAGS,
} from '@test/support';

import {AppThemeProvider} from '../ThemeProvider';
import {THEME_STORAGE_KEY} from '../themeStorage';
import {useAppTheme} from '../useAppTheme';

function ThemeProbe() {
  const {theme, themeId, setThemeId} = useAppTheme();
  return (
    <>
      <Text onPress={() => setThemeId('dark')} testID="probe">
        {themeId}
      </Text>
      <Text testID="probe-theme">{theme.id}</Text>
    </>
  );
}

async function renderWithProviders() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
      >
        <AppThemeProvider>
          <ThemeProbe />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
  });
  return tree;
}

describe('AppThemeProvider', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('useAppTheme throws outside the provider', async () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    let caught: Error | undefined;

    class TestBoundary extends React.Component<
      {children: React.ReactNode},
      {error: Error | null}
    > {
      state = {error: null as Error | null};

      static getDerivedStateFromError(error: Error) {
        return {error};
      }

      render() {
        if (this.state.error) {
          caught = this.state.error;
          return null;
        }
        return this.props.children;
      }
    }

    await act(async () => {
      ReactTestRenderer.create(
        <FeatureFlagProvider>
          <TestBoundary>
            <ThemeProbe />
          </TestBoundary>
        </FeatureFlagProvider>,
      );
    });

    expect(caught?.message).toContain(
      'useAppTheme must be used within an AppThemeProvider',
    );
    consoleSpy.mockRestore();
  });

  it('defaults to the light theme when nothing is persisted', async () => {
    const tree = await renderWithProviders();
    expect(tree.root.findByProps({testID: 'probe'}).props.children).toBe(
      'default',
    );
  });

  it('restores a valid persisted theme on mount', async () => {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const tree = await renderWithProviders();
    expect(tree.root.findByProps({testID: 'probe'}).props.children).toBe(
      'dark',
    );
  });

  it('falls back to the light theme for an unknown/removed persisted id', async () => {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, 'ocean-removed');
    const tree = await renderWithProviders();
    expect(tree.root.findByProps({testID: 'probe'}).props.children).toBe(
      'default',
    );
  });

  it('falls back to default when a persisted theme flag is disabled', async () => {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, 'dark');
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <FeatureFlagProvider
          releaseConfig={makeTestReleaseConfig(CORE_BETA_WITHOUT_REVIEW)}
        >
          <AppThemeProvider>
            <ThemeProbe />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(tree.root.findByProps({testID: 'probe'}).props.children).toBe(
      'default',
    );
    expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('default');
  });

  it('setThemeId updates context and persists', async () => {
    const tree = await renderWithProviders();
    await act(async () => {
      tree.root.findByProps({testID: 'probe'}).props.onPress();
    });
    expect(tree.root.findByProps({testID: 'probe'}).props.children).toBe(
      'dark',
    );
    expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('restores the system preference and resolves it to a concrete theme', async () => {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, 'system');
    const tree = await renderWithProviders();
    // Jest has no OS color scheme, so system resolves to the light theme.
    expect(tree.root.findByProps({testID: 'probe'}).props.children).toBe(
      'system',
    );
    expect(tree.root.findByProps({testID: 'probe-theme'}).props.children).toBe(
      'default',
    );
  });

  it('resolves the system preference to the dark theme when the OS is dark', async () => {
    // The RN jest preset mocks useColorScheme as jest.fn(() => 'light').
    const mockUseColorScheme = useColorScheme as unknown as jest.Mock;
    mockUseColorScheme.mockReturnValue('dark');
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, 'system');
      const tree = await renderWithProviders();
      expect(tree.root.findByProps({testID: 'probe'}).props.children).toBe(
        'system',
      );
      expect(
        tree.root.findByProps({testID: 'probe-theme'}).props.children,
      ).toBe('dark');
    } finally {
      mockUseColorScheme.mockReturnValue('light');
    }
  });

  it('restores a persisted sticker-soft theme on production (it is a production option)', async () => {
    const originalDev = (globalThis as {__DEV__?: boolean}).__DEV__;
    (globalThis as {__DEV__?: boolean}).__DEV__ = false;
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, 'sticker-soft');
      const tree = await renderWithProviders();
      expect(tree.root.findByProps({testID: 'probe'}).props.children).toBe(
        'sticker-soft',
      );
    } finally {
      (globalThis as {__DEV__?: boolean}).__DEV__ = originalDev;
    }
  });

  it('falls back to the light theme for a persisted experimental theme on production', async () => {
    const originalDev = (globalThis as {__DEV__?: boolean}).__DEV__;
    (globalThis as {__DEV__?: boolean}).__DEV__ = false;
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, 'pastel-kids');
      const tree = await renderWithProviders();
      expect(tree.root.findByProps({testID: 'probe'}).props.children).toBe(
        'default',
      );
      expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('default');
    } finally {
      (globalThis as {__DEV__?: boolean}).__DEV__ = originalDev;
    }
  });
});
