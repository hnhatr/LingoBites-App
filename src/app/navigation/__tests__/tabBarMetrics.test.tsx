import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {Text} from 'react-native';
import {ThemeContext} from '@ui/theme/useAppTheme';
import {coreTheme} from '@ui/theme/themes/core';
import {defaultTheme} from '@ui/theme/themes/default';
import {stickerSoftTheme} from '@ui/theme/themes/stickerSoft';
import type {AppTheme} from '@ui/theme/types';
import {
  FLOATING_TAB_BAR_BOTTOM_GAP,
  FLOATING_TAB_BAR_CONTENT_GAP,
  FLOATING_TAB_BAR_HEIGHT,
  STICKER_TAB_BAR_FACE_HEIGHT,
  getFloatingTabBarClearance,
  getTabBarVisualHeight,
  useFloatingTabBarClearance,
} from '@ui/components/layout';

function ClearanceProbe() {
  return <Text testID="clearance">{useFloatingTabBarClearance()}</Text>;
}

function clearanceWith(theme?: AppTheme): number {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  const children = <ClearanceProbe />;
  act(() => {
    tree =
      theme === undefined
        ? ReactTestRenderer.create(children)
        : ReactTestRenderer.create(
            <ThemeContext.Provider
              value={{
                theme,
                themeId: 'default' as never,
                setThemeId: jest.fn(),
              }}
            >
              {children}
            </ThemeContext.Provider>,
          );
  });
  return Number(tree.root.findByProps({testID: 'clearance'}).props.children);
}

describe('tabBarMetrics theme-aware clearance (SETE-269 P1)', () => {
  it('uses the standard 60pt face for non-shelf themes', () => {
    expect(getTabBarVisualHeight(defaultTheme)).toBe(FLOATING_TAB_BAR_HEIGHT);
    expect(getTabBarVisualHeight(coreTheme)).toBe(FLOATING_TAB_BAR_HEIGHT);
    expect(getTabBarVisualHeight(undefined)).toBe(FLOATING_TAB_BAR_HEIGHT);
  });

  it('uses the 66pt face plus shelf for Sticker', () => {
    expect(getTabBarVisualHeight(stickerSoftTheme)).toBe(
      STICKER_TAB_BAR_FACE_HEIGHT +
        (stickerSoftTheme.shelf?.tabBar.height ?? 0),
    );
    expect(getTabBarVisualHeight(stickerSoftTheme)).toBe(73);
  });

  it('derives clearance from the active theme bar height', () => {
    expect(getFloatingTabBarClearance(20, 73)).toBe(
      73 + FLOATING_TAB_BAR_BOTTOM_GAP + 20 + FLOATING_TAB_BAR_CONTENT_GAP,
    );
    // Default parameter preserves the legacy 60pt behavior.
    expect(getFloatingTabBarClearance(20)).toBe(
      FLOATING_TAB_BAR_HEIGHT +
        FLOATING_TAB_BAR_BOTTOM_GAP +
        20 +
        FLOATING_TAB_BAR_CONTENT_GAP,
    );
  });

  it('hook follows the active theme and falls back without a provider', () => {
    expect(clearanceWith(stickerSoftTheme)).toBe(
      73 + FLOATING_TAB_BAR_BOTTOM_GAP + 0 + FLOATING_TAB_BAR_CONTENT_GAP,
    );
    expect(clearanceWith(defaultTheme)).toBe(
      60 + FLOATING_TAB_BAR_BOTTOM_GAP + 0 + FLOATING_TAB_BAR_CONTENT_GAP,
    );
    expect(clearanceWith(undefined)).toBe(
      60 + FLOATING_TAB_BAR_BOTTOM_GAP + 0 + FLOATING_TAB_BAR_CONTENT_GAP,
    );
  });
});
