/**
 * Shared metrics for the floating bottom tab bar (SETE-214, Option C v3).
 *
 * The bar is a floating pill: horizontal margin 14–16px, 12px above the
 * bottom safe-area, ~60px visual height (container vertical padding 5px,
 * item padding 4–5px, icon 21px, label 10.5px/13px).
 *
 * Screens with feeds under the tabs must reserve
 * `getFloatingTabBarClearance(insets.bottom)` as bottom padding so the
 * floating pill never covers the last row.
 */
import {useContext} from 'react';
import {SafeAreaInsetsContext} from 'react-native-safe-area-context';
import type {AppTheme} from '@ui/theme/types';
import {ThemeContext} from '@ui/theme/useAppTheme';

export const FLOATING_TAB_BAR_HEIGHT = 60;
/** Sticker face height — see `TabBar.tsx` (`height: theme.shelf ? 66`). */
export const STICKER_TAB_BAR_FACE_HEIGHT = 66;
// Small lift above the bottom safe-area so the pill breathes —
// per SETE-214 review feedback.
export const FLOATING_TAB_BAR_BOTTOM_GAP = 8;
export const FLOATING_TAB_BAR_HORIZONTAL_MARGIN = 16;
/** Breathing room between the last feed row and the floating pill. */
export const FLOATING_TAB_BAR_CONTENT_GAP = 16;

/**
 * Rendered vertical footprint of the floating bar for a theme: face
 * height plus the shelf it casts (SETE-269 P1). Sticker renders a
 * 66pt face with a 7pt shelf (73pt total); every other theme renders
 * the standard 60pt face with no shelf.
 */
export function getTabBarVisualHeight(theme?: AppTheme): number {
  if (theme?.shelf) {
    return STICKER_TAB_BAR_FACE_HEIGHT + (theme.shelf.tabBar?.height ?? 0);
  }
  return FLOATING_TAB_BAR_HEIGHT;
}

export function getFloatingTabBarClearance(
  bottomInset: number,
  barHeight: number = FLOATING_TAB_BAR_HEIGHT,
): number {
  return (
    barHeight +
    FLOATING_TAB_BAR_BOTTOM_GAP +
    bottomInset +
    FLOATING_TAB_BAR_CONTENT_GAP
  );
}

/**
 * Safe `useSafeAreaInsets().bottom`-based clearance for feed screens.
 * Reads `SafeAreaInsetsContext` directly so screens render outside a
 * `SafeAreaProvider` (e.g. Jest) fall back to a zero inset instead of
 * throwing like `useSafeAreaInsets()` does. The bar height follows the
 * active theme (Sticker is taller); outside a theme provider it falls
 * back to the standard height instead of throwing like `useAppTheme()`.
 */
export function useFloatingTabBarClearance(): number {
  const insets = useContext(SafeAreaInsetsContext);
  const themeValue = useContext(ThemeContext);
  return getFloatingTabBarClearance(
    insets?.bottom ?? 0,
    getTabBarVisualHeight(themeValue?.theme),
  );
}

/**
 * Applies an alpha channel to an `#rgb` / `#rrggbb` theme color.
 * Falls back to the solid color when the value cannot be parsed, so
 * non-hex theme tokens keep rendering instead of breaking.
 */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.startsWith('#') ? color.slice(1) : color;
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map(part => part + part)
          .join('')
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return color;
  }
  const red = parseInt(full.slice(0, 2), 16);
  const green = parseInt(full.slice(2, 4), 16);
  const blue = parseInt(full.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}
