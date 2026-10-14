import type {AppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';

import type {LibraryTone} from '../logic/librarySections';

/**
 * One colour per Library tone, the same in every theme (like the level
 * colours), so a tab and its folder keep their colour in Light and Dark.
 */
const TONE_STRONG: Record<LibraryTone, string> = {
  teal: '#0f8a7c',
  coral: '#c93a59',
  yellow: '#f2c230',
  violet: '#6a4fc9',
};

export interface LibraryToneColors {
  /** Solid fill: the open tab, icon tiles, filled progress dots. */
  strong: string;
  /** Text and icons drawn on `strong`. */
  onStrong: string;
  /** Pale fill: folders and closed tabs, the colour washed over the surface. */
  soft: string;
  /** Icons and small labels on `soft`. */
  ink: string;
}

/** Colours of the Explore cards, the same three as the Courses cards. */
export type CardTone = 'accent' | 'tertiary' | 'secondary';

const CARD_TONES: readonly CardTone[] = ['accent', 'tertiary', 'secondary'];

/** Cycles card colours down a list so neighbours differ. */
export function cardToneAt(index: number): CardTone {
  return CARD_TONES[index % CARD_TONES.length];
}

export function libraryTone(
  theme: AppTheme,
  tone: LibraryTone,
): LibraryToneColors {
  const strong = TONE_STRONG[tone];
  const [r, g, b] = [1, 3, 5].map(at => parseInt(strong.slice(at, at + 2), 16));
  const yellow = tone === 'yellow';
  return {
    strong,
    onStrong: yellow ? '#1c1c10' : '#ffffff',
    soft: solidOver(`rgba(${r}, ${g}, ${b}, 0.18)`, theme.colors.surface),
    // Yellow is too light for text, so its labels take the theme's text.
    ink: yellow ? theme.colors.text.secondary : strong,
  };
}
