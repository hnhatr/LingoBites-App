import React from 'react';
import {StyleSheet, Text} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {FeatureFlagProvider} from '@core/release';
import type {ReleaseConfig} from '@core/release/types';
import {
  CORE_BETA_WITHOUT_REVIEW,
  FULL_FEATURE_SHOWCASE_FLAGS,
  makeTestReleaseConfig,
  OFFLINE_REVIEW_MVP,
  THEME_UI_FLAGS,
} from '@test/support';
import {AppThemeProvider} from '@ui/theme';
import {ThemeContext} from '@ui/theme/useAppTheme';
import {defaultTheme} from '@ui/theme/themes/default';
import {stickerSoftTheme} from '@ui/theme/themes/stickerSoft';
import type {AppTheme} from '@ui/theme/types';
import {themeIds, themes} from '@ui/theme/themeRegistry';
import {ThemePicker} from '../ThemePicker';

async function render(releaseConfig: ReleaseConfig) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider releaseConfig={releaseConfig}>
        <AppThemeProvider>
          <ThemePicker />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
  });
  return tree;
}

function labelsOf(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  const seen = new Set<string>();
  return tree.root
    .findAll(node => {
      const testID = String(node.props.testID ?? '');
      if (!testID.startsWith('theme-option-') || seen.has(testID)) {
        return false;
      }
      seen.add(testID);
      return true;
    })
    .map(n => n.props.accessibilityLabel);
}

describe('ThemePicker', () => {
  it('renders nothing when themeSwitcher is disabled', async () => {
    const tree = await render(makeTestReleaseConfig(OFFLINE_REVIEW_MVP));
    expect(labelsOf(tree)).toEqual([]);
  });

  it('shows all eight dev themes plus the system option with the full theme stack', async () => {
    const labels = labelsOf(
      await render(makeTestReleaseConfig(FULL_FEATURE_SHOWCASE_FLAGS)),
    );
    expect(labels).toHaveLength(9);
    expect(labels).toEqual([
      ...themeIds.map(id => themes[id].name),
      'Theo hệ thống',
    ]);
  });

  it('offers exactly Sáng / Tối / Sticker / Theo hệ thống on production builds', async () => {
    const originalDev = (globalThis as {__DEV__?: boolean}).__DEV__;
    (globalThis as {__DEV__?: boolean}).__DEV__ = false;
    try {
      const labels = labelsOf(
        await render(makeTestReleaseConfig(FULL_FEATURE_SHOWCASE_FLAGS)),
      );
      expect(labels).toEqual(['Sáng', 'Tối', 'Sticker', 'Theo hệ thống']);
    } finally {
      (globalThis as {__DEV__?: boolean}).__DEV__ = originalDev;
    }
  });

  it('hides dark when its flag is off', async () => {
    const labels = labelsOf(
      await render(makeTestReleaseConfig(CORE_BETA_WITHOUT_REVIEW)),
    );
    expect(labels).toContain(themes.default.name);
    expect(labels).toContain(themes['pastel-kids'].name);
    expect(labels).not.toContain(themes.dark.name);
  });

  it('applies a theme on tap', async () => {
    const tree = await render(makeTestReleaseConfig(THEME_UI_FLAGS));
    const darkOption = tree.root
      .findAll(node =>
        String(node.props.testID ?? '').startsWith('theme-option-'),
      )
      .find(n => n.props.accessibilityLabel === themes.dark.name)!;
    await act(async () => {
      darkOption.props.onPress();
    });
    expect(darkOption.props.accessibilityState.selected).toBe(true);
  });

  it('uses stable per-theme test ids and a 44px minimum target', async () => {
    const tree = await render(makeTestReleaseConfig(THEME_UI_FLAGS));
    const darkOption = tree.root.findByProps({testID: 'theme-option-dark'});
    const flattened = StyleSheet.flatten(darkOption.props.style);

    expect(darkOption.props.accessibilityLabel).toBe(themes.dark.name);
    expect(flattened.minHeight).toBe(44);
  });

  it('keeps chip geometry identical across themes (SETE-269 P1)', async () => {
    const chipGeometry = async (theme: AppTheme) => {
      let tree!: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = ReactTestRenderer.create(
          <FeatureFlagProvider
            releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
          >
            <ThemeContext.Provider
              value={{
                theme,
                themeId: 'default' as never,
                setThemeId: jest.fn(),
              }}
            >
              <ThemePicker />
            </ThemeContext.Provider>
          </FeatureFlagProvider>,
        );
      });
      await act(async () => {
        await Promise.resolve();
      });
      const chip = StyleSheet.flatten(
        tree.root.findByProps({testID: 'theme-option-dark'}).props.style,
      );
      const label = StyleSheet.flatten(
        tree.root
          .findAllByType(Text)
          .find(node => node.props.children === themes.dark.name)!.props.style,
      );
      return {
        borderRadius: chip.borderRadius,
        minHeight: chip.minHeight,
        paddingHorizontal: chip.paddingHorizontal,
        paddingVertical: chip.paddingVertical,
        fontSize: label.fontSize,
        fontWeight: label.fontWeight,
      };
    };

    // Sticker previously changed radius, spacing, and type while in use,
    // moving adjacent targets under the user's finger.
    expect(await chipGeometry(stickerSoftTheme)).toEqual(
      await chipGeometry(defaultTheme),
    );
  });
});
