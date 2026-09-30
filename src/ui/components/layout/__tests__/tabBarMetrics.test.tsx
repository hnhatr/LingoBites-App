import React from 'react';
import {Text} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {coreTheme} from '@ui/theme/themes/core';
import {defaultTheme} from '@ui/theme/themes/default';
import {stickerSoftTheme} from '@ui/theme/themes/stickerSoft';
import type {AppTheme} from '@ui/theme/types';
import {ThemeContext} from '@ui/theme/useAppTheme';

import {
  FLOATING_TAB_BAR_BOTTOM_GAP,
  FLOATING_TAB_BAR_CONTENT_GAP,
  FLOATING_TAB_BAR_HEIGHT,
  getFloatingTabBarClearance,
  getTabBarVisualHeight,
  STICKER_TAB_BAR_FACE_HEIGHT,
  useFloatingTabBarClearance,
  withAlpha,
} from '../tabBarMetrics';

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
  const node = tree.root.findByProps({testID: 'clearance'});
  return Number(node.props.children);
}

describe('tabBarMetrics in @components/layout (TASK-003)', () => {
  it('reports standard clearance when no theme provider is mounted', () => {
    expect(clearanceWith(undefined)).toBe(
      FLOATING_TAB_BAR_HEIGHT +
        FLOATING_TAB_BAR_BOTTOM_GAP +
        0 +
        FLOATING_TAB_BAR_CONTENT_GAP,
    );
  });

  it('reports standard clearance for standard non-shelf themes', () => {
    expect(clearanceWith(defaultTheme)).toBe(
      FLOATING_TAB_BAR_HEIGHT +
        FLOATING_TAB_BAR_BOTTOM_GAP +
        0 +
        FLOATING_TAB_BAR_CONTENT_GAP,
    );
    expect(clearanceWith(coreTheme)).toBe(
      FLOATING_TAB_BAR_HEIGHT +
        FLOATING_TAB_BAR_BOTTOM_GAP +
        0 +
        FLOATING_TAB_BAR_CONTENT_GAP,
    );
  });

  it('incorporates face and shelf height for Sticker themes', () => {
    const shelfHeight = stickerSoftTheme.shelf?.tabBar?.height ?? 0;
    const expected =
      STICKER_TAB_BAR_FACE_HEIGHT +
      shelfHeight +
      FLOATING_TAB_BAR_BOTTOM_GAP +
      0 +
      FLOATING_TAB_BAR_CONTENT_GAP;
    expect(clearanceWith(stickerSoftTheme)).toBe(expected);
  });

  it('handles withAlpha correctly', () => {
    expect(withAlpha('#ffffff', 0.5)).toBe('rgba(255,255,255,0.5)');
    expect(withAlpha('#fff', 1)).toBe('rgba(255,255,255,1)');
    expect(withAlpha('invalid', 0.5)).toBe('invalid');
  });

  it('computes visual height and clearance via direct helper calls', () => {
    expect(getTabBarVisualHeight(defaultTheme)).toBe(FLOATING_TAB_BAR_HEIGHT);
    expect(
      getFloatingTabBarClearance(0, getTabBarVisualHeight(defaultTheme)),
    ).toBe(
      FLOATING_TAB_BAR_HEIGHT +
        FLOATING_TAB_BAR_BOTTOM_GAP +
        0 +
        FLOATING_TAB_BAR_CONTENT_GAP,
    );
  });
});
