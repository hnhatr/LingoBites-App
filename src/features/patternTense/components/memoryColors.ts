import type {AppTheme} from '@ui/theme';

import type {MemoryLevel} from '../logic/libraryModel';

/** Face and ink of a cell by how well the tense is remembered. */
export function levelColors(theme: AppTheme, level: MemoryLevel) {
  const {colors} = theme;
  switch (level) {
    case 'new':
      return {face: colors.surfaceContainer, ink: colors.text.secondary};
    case 'started':
      return {face: colors.tertiarySoft, ink: colors.text.primary};
    case 'recalling':
      return {face: colors.secondarySoft, ink: colors.text.primary};
    case 'stable':
      return {face: colors.accentSoft, ink: colors.accentInk};
  }
}
