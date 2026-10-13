import {solidOver} from './colorUtils';
import type {AppTheme} from './types';

/** CEFR levels a library card can show. */
export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

/**
 * One colour per CEFR level, the same in every theme, so a learner reads the
 * level from the colour of a card: A1 teal, A2 green, B1 amber, B2 orange,
 * C1 rose, C2 purple. Content without a level uses the neutral entry.
 */
const LEVEL_STRONG: Record<CefrLevel | 'none', string> = {
  A1: '#1fb5a3',
  A2: '#6cb83f',
  B1: '#e3a91a',
  B2: '#f07a2e',
  C1: '#e0456a',
  C2: '#7457d1',
  none: '#8a8672',
};

/** A known CEFR level from any spelling (`a1`, ` B2 `), else null. */
export function cefrLevelOf(raw: string | null | undefined): CefrLevel | null {
  const level = raw?.trim().toUpperCase();
  return (CEFR_LEVELS as readonly string[]).includes(level ?? '')
    ? (level as CefrLevel)
    : null;
}

export interface LevelTone {
  /** Chip fill, pattern and icon colour. */
  strong: string;
  /** Default cover fill: the level colour washed over the theme surface. */
  soft: string;
  /** Text on `strong` (the level chip). */
  on: string;
}

export function levelTone(
  theme: AppTheme,
  level: string | null | undefined,
): LevelTone {
  const strong = LEVEL_STRONG[cefrLevelOf(level) ?? 'none'];
  const [r, g, b] = [1, 3, 5].map(at => parseInt(strong.slice(at, at + 2), 16));
  return {
    strong,
    on: strong === LEVEL_STRONG.B1 ? '#1c1c10' : '#ffffff',
    soft: solidOver(`rgba(${r}, ${g}, ${b}, 0.2)`, theme.colors.surface),
  };
}
