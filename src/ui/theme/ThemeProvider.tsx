import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useColorScheme} from 'react-native';

import {useFeatureFlags} from '@core/release';

import {
  defaultThemeId,
  isThemePreference,
  productionThemeOptions,
  SYSTEM_THEME_ID,
  type ThemePreference,
  themeReleaseFlag,
  themes,
} from './themeRegistry';
import {getSavedThemeId, saveThemeId} from './themeStorage';
import {ThemeContext} from './useAppTheme';

type Props = {children: React.ReactNode};

export function AppThemeProvider({children}: Props) {
  const {isFeatureEnabled} = useFeatureFlags();
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] =
    useState<ThemePreference>(defaultThemeId);

  const isThemeAllowed = useCallback(
    (id: ThemePreference) => {
      // Every build offers exactly the picker options (only Sticker).
      // productionThemeOptions is the single source of truth so the gate
      // cannot drift from the picker (SETE-280).
      if (!productionThemeOptions.includes(id)) {
        return false;
      }
      if (id === SYSTEM_THEME_ID) {
        return true;
      }
      const flag = themeReleaseFlag[id];
      return flag === undefined || isFeatureEnabled(flag);
    },
    [isFeatureEnabled],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const saved = await getSavedThemeId();
      if (!active) {
        return;
      }
      if (saved !== null && isThemePreference(saved)) {
        if (isThemeAllowed(saved)) {
          setPreferenceState(saved);
        } else {
          setPreferenceState(defaultThemeId);
          saveThemeId(defaultThemeId).catch(() => {});
        }
      } else {
        setPreferenceState(defaultThemeId);
      }
    })();
    return () => {
      active = false;
    };
  }, [isThemeAllowed]);

  const setThemeId = useCallback(
    (id: ThemePreference) => {
      if (!isThemePreference(id) || !isThemeAllowed(id)) {
        return;
      }
      setPreferenceState(id);
      saveThemeId(id).catch(() => {});
    },
    [isThemeAllowed],
  );

  const theme =
    preference === SYSTEM_THEME_ID
      ? systemScheme === 'dark'
        ? themes.dark
        : themes.default
      : themes[preference];

  const value = useMemo(
    () => ({theme, themeId: preference, setThemeId}),
    [theme, preference, setThemeId],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
