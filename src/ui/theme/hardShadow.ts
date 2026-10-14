import {Platform, type ViewStyle} from 'react-native';

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

/**
 * A sticker surface's ink edge that looks the same on both platforms: the
 * hard shadow on iOS, and on Android (whose elevation always blurs) a thick
 * bottom border in the same colour. The border sits inside the box, so a
 * pressed state that drops `offset` to 1 also shortens the box, like the
 * shadow shrinking under it.
 */
export function getStickerEdge(offset: number, color: string): ViewStyle {
  if (Platform.OS === 'android') {
    return {borderBottomWidth: offset, borderColor: color};
  }
  return getHardShadow(offset, color);
}

/** Light and Dark share the sticker look; other themes keep their own surfaces. */
export function isStickerTheme(theme: AppTheme): boolean {
  return theme.id === 'default' || theme.id === 'dark';
}

/**
 * Optional hard shadow for sticker-style surfaces (no ink outline: it read
 * too heavy). Returns `undefined` on other themes so callers can spread it
 * unconditionally. A shadow requires the surface to have an opaque
 * background.
 */
export function getStickerFace(
  theme: AppTheme,
  shadowOffset = 0,
): ViewStyle | undefined {
  if (!isStickerTheme(theme)) {
    return undefined;
  }
  return shadowOffset > 0 ? getHardShadow(shadowOffset, theme.colors.ink) : {};
}
