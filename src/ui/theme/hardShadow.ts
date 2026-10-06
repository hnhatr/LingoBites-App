import type {ViewStyle} from 'react-native';

import type {AppTheme} from './types';

/**
 * Solid, un-blurred offset shadow used by sticker-style surfaces. The
 * surface it is applied to must have an opaque background (see `solidOver`).
 */
export function getHardShadow(offset: number, color: string): ViewStyle {
  return {
    shadowColor: color,
    shadowOffset: {width: 0, height: offset},
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: offset,
  };
}

/** Light and Dark share the sticker look; other themes keep their own surfaces. */
export function isStickerTheme(theme: AppTheme): boolean {
  return theme.id === 'default' || theme.id === 'dark';
}

/**
 * Ink outline (+ optional hard shadow) for sticker-style surfaces. Returns
 * `undefined` on other themes so callers can spread it unconditionally. A
 * shadow requires the surface to have an opaque background.
 */
export function getStickerFace(
  theme: AppTheme,
  shadowOffset = 0,
  borderWidth = 2,
): ViewStyle | undefined {
  if (!isStickerTheme(theme)) {
    return undefined;
  }
  return {
    borderColor: theme.colors.ink,
    borderWidth,
    ...(shadowOffset > 0 ? getHardShadow(shadowOffset, theme.colors.ink) : {}),
  };
}
