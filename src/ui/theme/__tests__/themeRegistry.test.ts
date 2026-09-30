import {
  defaultThemeId,
  isThemeId,
  isThemePreference,
  productionThemeOptions,
  SYSTEM_THEME_ID,
  themeIds,
  themeList,
  themeReleaseFlag,
  themes,
} from '../themeRegistry';

describe('themeRegistry', () => {
  it('exposes the confirmed themes', () => {
    expect(Object.keys(themes).sort()).toEqual([
      'cartoon',
      'comic',
      'core',
      'dark',
      'default',
      'neo',
      'pastel-kids',
      'sticker-soft',
    ]);
  });

  it('themeIds and themeList are derived from the themes map', () => {
    expect(themeIds).toEqual(Object.keys(themes));
    expect(themeList.map(t => t.id)).toEqual(themeIds);
  });

  it('defaultThemeId points to an existing theme', () => {
    expect(themes[defaultThemeId]).toBeDefined();
    expect(defaultThemeId).toBe('default');
  });

  it('isThemeId accepts known ids and rejects everything else', () => {
    expect(isThemeId('dark')).toBe(true);
    expect(isThemeId('pastel-kids')).toBe(true);
    expect(isThemeId('nope')).toBe(false);
    expect(isThemeId(undefined)).toBe(false);
    expect(isThemeId(42)).toBe(false);
  });

  it('maps gated themes to their release feature flag; default is ungated', () => {
    expect(themeReleaseFlag.dark).toBe('darkTheme');
    expect(themeReleaseFlag['pastel-kids']).toBe('pastelKidsTheme');
    expect(themeReleaseFlag.core).toBe('coreTheme');
    expect(themeReleaseFlag.neo).toBe('neoTheme');
    expect(themeReleaseFlag.comic).toBe('comicTheme');
    expect(themeReleaseFlag.cartoon).toBe('cartoonTheme');
    expect(themeReleaseFlag['sticker-soft']).toBe('stickerSoftTheme');
    expect(themeReleaseFlag.default).toBeUndefined();
  });

  it('exposes the production picker options plus the system preference', () => {
    expect(productionThemeOptions).toEqual([
      'default',
      'dark',
      'sticker-soft',
      SYSTEM_THEME_ID,
    ]);
    expect(isThemePreference('system')).toBe(true);
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('nope')).toBe(false);
  });
});
