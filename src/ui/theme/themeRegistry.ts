import type {FeatureKey} from '../../release/feature-registry';
import {cartoonTheme} from './themes/cartoon';
import {comicTheme} from './themes/comic';
import {coreTheme} from './themes/core';
import {darkTheme} from './themes/dark';
import {defaultTheme} from './themes/default';
import {neoTheme} from './themes/neo';
import {pastelKidsTheme} from './themes/pastelKids';
import {stickerSoftTheme} from './themes/stickerSoft';
import type {AppTheme} from './types';

export const themes = {
  default: defaultTheme,
  dark: darkTheme,
  'pastel-kids': pastelKidsTheme,
  core: coreTheme,
  neo: neoTheme,
  comic: comicTheme,
  cartoon: cartoonTheme,
  'sticker-soft': stickerSoftTheme,
} satisfies Record<string, AppTheme>;

export type ThemeId = keyof typeof themes;

export const themeIds = Object.keys(themes) as ThemeId[];

export const themeList: AppTheme[] = themeIds.map(id => themes[id]);

export const defaultThemeId: ThemeId = 'default';

export const isThemeId = (value: unknown): value is ThemeId =>
  typeof value === 'string' && value in themes;

export const themeReleaseFlag: Partial<Record<ThemeId, FeatureKey>> = {
  dark: 'darkTheme',
  'pastel-kids': 'pastelKidsTheme',
  core: 'coreTheme',
  neo: 'neoTheme',
  comic: 'comicTheme',
  cartoon: 'cartoonTheme',
  'sticker-soft': 'stickerSoftTheme',
};

/**
 * Pseudo-preference that resolves to Sáng/Tối from the OS color scheme.
 * It is a picker-level choice, not an entry in `themes`.
 */
export const SYSTEM_THEME_ID = 'system' as const;

export type SystemThemeId = typeof SYSTEM_THEME_ID;

export type ThemePreference = ThemeId | SystemThemeId;

export const SYSTEM_THEME_LABEL = 'Theo hệ thống';

/**
 * The production theme picker offers exactly these four options.
 * Experimental themes (pastel-kids, core, neo, comic, cartoon) stay
 * available in dev builds only.
 */
export const productionThemeOptions: readonly ThemePreference[] = [
  'default',
  'dark',
  'sticker-soft',
  SYSTEM_THEME_ID,
];

export const isThemePreference = (value: unknown): value is ThemePreference =>
  value === SYSTEM_THEME_ID || isThemeId(value);
