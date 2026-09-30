import React from 'react';
import {StatusBar} from 'react-native';

import {useAppTheme} from './useAppTheme';

/**
 * Binds the native status-bar content style to the *resolved* app theme
 * (SETE-269 P0). The previous implementation in `App.tsx` read the OS
 * color scheme directly, so picking Dark while the OS was light left
 * black status-bar content on the `#0b1120` background — invisible.
 *
 * The provider already resolves "Theo hệ thống" to a concrete light/dark
 * theme, so keying off the resolved theme also covers live OS-appearance
 * changes with no extra subscription.
 */
export function ThemedStatusBar() {
  const {theme} = useAppTheme();
  return (
    <StatusBar
      barStyle={theme.id === 'dark' ? 'light-content' : 'dark-content'}
    />
  );
}
