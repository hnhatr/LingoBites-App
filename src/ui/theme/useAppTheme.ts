import {createContext, useContext} from 'react';
import type {ThemePreference} from './themeRegistry';
import type {AppTheme} from './types';

export type ThemeContextValue = {
  theme: AppTheme;
  themeId: ThemePreference;
  setThemeId: (id: ThemePreference) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within an AppThemeProvider');
  }
  return ctx;
}
