import React from 'react';
import {StyleSheet, Text} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';
import {SYSTEM_THEME_LABEL, themeIds, themes} from '@ui/theme/themeRegistry';
import {defaultTheme} from '@ui/theme/themes/default';
import {stickerSoftTheme} from '@ui/theme/themes/stickerSoft';
import type {AppTheme} from '@ui/theme/types';
import {ThemeContext} from '@ui/theme/useAppTheme';

import {FeatureFlagProvider} from '@core/release';
import type {ReleaseConfig} from '@core/release/types';

import {
  FULL_FEATURE_SHOWCASE_FLAGS,
  makeTestReleaseConfig,
  OFFLINE_REVIEW_MVP,
  THEME_UI_FLAGS,
} from '@test/support';

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

  it('offers only Sticker in dev builds', async () => {
    const labels = labelsOf(
      await render(makeTestReleaseConfig(FULL_FEATURE_SHOWCASE_FLAGS)),
    );
    expect(labels).toEqual(['Sticker']);
  });

  it('offers only Sticker on production builds', async () => {
    const originalDev = (globalThis as {__DEV__?: boolean}).__DEV__;
    (globalThis as {__DEV__?: boolean}).__DEV__ = false;
    try {
      const labels = labelsOf(
        await render(makeTestReleaseConfig(FULL_FEATURE_SHOWCASE_FLAGS)),
      );
      expect(labels).toEqual(['Sticker']);
    } finally {
      (globalThis as {__DEV__?: boolean}).__DEV__ = originalDev;
    }
  });

  it('keeps hidden themes registered but out of the picker', async () => {
    const labels = labelsOf(
      await render(makeTestReleaseConfig(FULL_FEATURE_SHOWCASE_FLAGS)),
    );
    const hidden = [
      'default',
      'dark',
      'pastel-kids',
      'core',
      'neo',
      'comic',
      'cartoon',
    ] as const;
    expect(themeIds).toEqual(expect.arrayContaining([...hidden]));
    for (const id of hidden) {
      expect(labels).not.toContain(themes[id].name);
    }
    expect(labels).not.toContain(SYSTEM_THEME_LABEL);
  });

  it('marks Sticker as selected', async () => {
    const tree = await render(makeTestReleaseConfig(THEME_UI_FLAGS));
    const stickerOption = tree.root.findByProps({
      testID: 'theme-option-sticker-soft',
    });
    expect(stickerOption.props.accessibilityState.selected).toBe(true);
  });

  it('uses stable per-theme test ids and a 44px minimum target', async () => {
    const tree = await render(makeTestReleaseConfig(THEME_UI_FLAGS));
    const option = tree.root.findByProps({testID: 'theme-option-sticker-soft'});
    const flattened = StyleSheet.flatten(option.props.style);

    expect(option.props.accessibilityLabel).toBe(themes['sticker-soft'].name);
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
        tree.root.findByProps({testID: 'theme-option-sticker-soft'}).props
          .style,
      );
      const label = StyleSheet.flatten(
        tree.root
          .findAllByType(Text)
          .find(node => node.props.children === themes['sticker-soft'].name)!
          .props.style,
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
