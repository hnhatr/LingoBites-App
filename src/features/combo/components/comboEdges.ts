import type {AppTheme} from '@ui/theme';

/**
 * The sticker edges of the combo screens: under a mint, sun or coral face and
 * under the solid teal one. Themes without shelves use the sticker colours.
 */
export function comboEdges(theme: AppTheme) {
  return {
    mint: theme.shelf?.chipTeal.color ?? '#a9e2da',
    sun: theme.shelf?.chipYellow.color ?? '#ecd989',
    coral: theme.shelf?.chipPink.color ?? '#f4c1ca',
    teal: theme.shelf?.primary.color ?? '#004a41',
  };
}
