import React from 'react';
import {StatusBar} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {darkTheme} from '../themes/dark';
import {defaultTheme} from '../themes/default';
import {stickerSoftTheme} from '../themes/stickerSoft';
import {ThemedStatusBar} from '../ThemedStatusBar';
import {ThemeContext} from '../useAppTheme';
import type {AppTheme} from '../types';

function barStyleFor(theme: AppTheme): string {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <ThemeContext.Provider
        value={{theme, themeId: 'default' as never, setThemeId: jest.fn()}}
      >
        <ThemedStatusBar />
      </ThemeContext.Provider>,
    );
  });
  return tree.root.findByType(StatusBar).props.barStyle;
}

describe('ThemedStatusBar (SETE-269 P0)', () => {
  it('uses light content on the dark theme so the status bar stays readable', () => {
    expect(barStyleFor(darkTheme)).toBe('light-content');
  });

  it('uses dark content on light themes', () => {
    expect(barStyleFor(defaultTheme)).toBe('dark-content');
    expect(barStyleFor(stickerSoftTheme)).toBe('dark-content');
  });
});
