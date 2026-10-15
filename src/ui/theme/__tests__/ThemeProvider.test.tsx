import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import {Text} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {FeatureFlagProvider} from '@core/release';

import {makeTestReleaseConfig, THEME_UI_FLAGS} from '@test/support';

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

  it('defaults to Sticker when nothing is persisted', async () => {
    const tree = await renderWithProviders();
    expect(tree.root.findByProps({testID: 'probe'}).props.children).toBe(
      'sticker-soft',
    );
  });

  it('restores a persisted sticker-soft theme', async () => {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, 'sticker-soft');
    const tree = await renderWithProviders();
    expect(tree.root.findByProps({testID: 'probe'}).props.children).toBe(
      'sticker-soft',
    );
  });

  it('falls back to Sticker for an unknown/removed persisted id', async () => {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, 'ocean-removed');
    const tree = await renderWithProviders();
    expect(tree.root.findByProps({testID: 'probe'}).props.children).toBe(
      'sticker-soft',
    );
  });

  it.each(['default', 'dark', 'system', 'pastel-kids'])(
    'migrates a persisted hidden preference (%s) to Sticker',
    async saved => {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, saved);
      const tree = await renderWithProviders();
      expect(tree.root.findByProps({testID: 'probe'}).props.children).toBe(
        'sticker-soft',
      );
      expect(
        tree.root.findByProps({testID: 'probe-theme'}).props.children,
      ).toBe('sticker-soft');
      expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe(
        'sticker-soft',
      );
    },
  );

  it('migrates hidden preferences on production builds too', async () => {
    const originalDev = (globalThis as {__DEV__?: boolean}).__DEV__;
    (globalThis as {__DEV__?: boolean}).__DEV__ = false;
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, 'dark');
      const tree = await renderWithProviders();
      expect(tree.root.findByProps({testID: 'probe'}).props.children).toBe(
        'sticker-soft',
      );
    } finally {
      (globalThis as {__DEV__?: boolean}).__DEV__ = originalDev;
    }
  });

  it('ignores setThemeId for hidden themes', async () => {
    const tree = await renderWithProviders();
    await act(async () => {
      tree.root.findByProps({testID: 'probe'}).props.onPress();
    });
    expect(tree.root.findByProps({testID: 'probe'}).props.children).toBe(
      'sticker-soft',
    );
    expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });
});
