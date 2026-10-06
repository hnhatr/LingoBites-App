import type {ViewStyle} from 'react-native';

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
