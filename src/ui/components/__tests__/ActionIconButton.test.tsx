import React from 'react';
import {StyleSheet} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {type AppTheme, AppThemeProvider, useAppTheme} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {ActionIconButton} from '../ActionIconButton';
import {MaterialIcon} from '../MaterialIcon';
import {SaveToggle} from '../SaveToggle';

let theme!: AppTheme;

function ThemeProbe() {
  theme = useAppTheme().theme;
  return null;
}

async function render(element: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <ThemeProbe />
          {element}
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  const button = tree.root.findAll(
    node => node.props.testID === 'btn' && typeof node.type === 'string',
  )[0];
  const style = StyleSheet.flatten(
    typeof button.props.style === 'function'
      ? button.props.style({pressed: false})
      : button.props.style,
  );
  return {tree, button, style};
}

describe('ActionIconButton', () => {
  it('is a 40px beige square in a row by default', async () => {
    const {style, tree} = await render(
      <ActionIconButton
        accessibilityLabel="Nghe"
        icon="volume_up"
        onPress={() => {}}
        testID="btn"
      />,
    );
    expect(style.width).toBe(40);
    expect(style.height).toBe(40);
    expect(style.backgroundColor).toBe(theme.colors.surfaceMuted);
    expect(tree.root.findByType(MaterialIcon).props.color).toBe(
      theme.colors.primary,
    );
  });

  it('uses mint for AI actions and the large size in a card', async () => {
    const {style} = await render(
      <ActionIconButton
        accessibilityLabel="Phân tích"
        icon="auto_awesome"
        onPress={() => {}}
        size="large"
        testID="btn"
        tone="mint"
      />,
    );
    expect(style.width).toBe(64);
    expect(style.backgroundColor).toBe(theme.colors.accentSoft);
  });

  it('turns white on a tinted card', async () => {
    const {style} = await render(
      <ActionIconButton
        accessibilityLabel="Nghe"
        icon="volume_up"
        onPress={() => {}}
        onTint
        testID="btn"
      />,
    );
    expect(style.backgroundColor).toBe(theme.colors.surface);
  });

  it('calls onPress', async () => {
    const onPress = jest.fn();
    const {tree} = await render(
      <ActionIconButton
        accessibilityLabel="Đóng"
        icon="close"
        onPress={onPress}
        testID="btn"
      />,
    );
    const pressable = tree.root.findAll(
      node =>
        typeof node.type !== 'string' &&
        node.type !== ActionIconButton &&
        node.props.testID === 'btn' &&
        typeof node.props.onPress === 'function',
    )[0];
    act(() => pressable.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('SaveToggle raised', () => {
  it('is beige with a grey bookmark while unsaved', async () => {
    const {style, tree} = await render(
      <SaveToggle onPress={() => {}} raised="row" saved={false} testID="btn" />,
    );
    expect(style.backgroundColor).toBe(theme.colors.surfaceMuted);
    const icon = tree.root.findByType(MaterialIcon);
    expect(icon.props.name).toBe('bookmark_add');
    expect(icon.props.color).toBe(theme.colors.text.muted);
  });

  it('is mint with a filled bookmark once saved', async () => {
    const {style, button, tree} = await render(
      <SaveToggle onPress={() => {}} raised="row" saved testID="btn" />,
    );
    expect(style.backgroundColor).toBe(theme.colors.accentSoft);
    expect(button.props.accessibilityState.selected).toBe(true);
    expect(tree.root.findByType(MaterialIcon).props.name).toBe('bookmark');
  });
});
