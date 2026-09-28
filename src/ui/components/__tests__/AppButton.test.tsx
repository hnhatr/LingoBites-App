import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {FeatureFlagProvider} from '@/release';
import {AppThemeProvider} from '@ui/theme/index';
import {themes} from '@ui/theme/themeRegistry';
import {THEME_STORAGE_KEY} from '@ui/theme/themeStorage';
import {AppButton} from '../AppButton';

async function render(ui: React.ReactElement) {
  // These assertions target pastel-kids-only button variants, so pin the
  // active theme instead of depending on the app default (Sáng).
  await AsyncStorage.setItem(THEME_STORAGE_KEY, 'pastel-kids');
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>{ui}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

import {StyleSheet} from 'react-native';

describe('AppButton', () => {
  it('primary variant uses components.button.primary-accent background', async () => {
    const tree = await render(<AppButton title="Go" onPress={() => {}} />);
    const face = tree.root.findByProps({testID: 'app-button-face'});
    const flattened = StyleSheet.flatten(face.props.style);
    expect(flattened.backgroundColor).toBe(
      themes['pastel-kids'].components.button['primary-accent'].background,
    );
  });

  it('outline variant uses a border', async () => {
    const tree = await render(
      <AppButton title="Back" variant="outline" onPress={() => {}} />,
    );
    const face = tree.root.findByProps({testID: 'app-button-face'});
    const flattened = StyleSheet.flatten(face.props.style);
    expect(flattened.borderColor).toBe(
      themes['pastel-kids'].components.button.outline.border,
    );
    expect(flattened.borderWidth).toBe(2);
  });

  it('fires onPress', async () => {
    const onPress = jest.fn();
    const tree = await render(<AppButton title="Go" onPress={onPress} />);
    await act(async () => {
      tree.root.findByProps({testID: 'app-button'}).props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
