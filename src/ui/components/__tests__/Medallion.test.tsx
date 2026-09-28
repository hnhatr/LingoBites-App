import React from 'react';
import {StyleSheet, Text} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {FeatureFlagProvider} from '@core/release/index';
import {makeTestReleaseConfig, THEME_UI_FLAGS} from '@/test-support';
import {AppThemeProvider, useAppTheme, type AppTheme} from '@ui/theme/index';
import {Medallion} from '../Medallion';

let activeTheme!: AppTheme;

function ThemeProbe() {
  const {theme} = useAppTheme();
  activeTheme = theme;
  return null;
}

async function renderWithTheme(ui: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
      >
        <AppThemeProvider>
          <ThemeProbe />
          {ui}
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

function containerStyleOf(tree: ReactTestRenderer.ReactTestRenderer) {
  const hosts = tree.root
    .findAllByProps({testID: 'medallion'})
    .filter(node => typeof node.type === 'string');
  if (hosts.length === 0) {
    throw new Error('medallion host container not found');
  }
  return StyleSheet.flatten(hosts[0].props.style);
}

function labelStyleOf(
  tree: ReactTestRenderer.ReactTestRenderer,
  label: string,
) {
  const labelText = tree.root
    .findAllByType(Text)
    .find(node => node.props.children === label);
  if (!labelText) {
    throw new Error(`medallion label "${label}" not found`);
  }
  return StyleSheet.flatten(labelText.props.style);
}

describe('Medallion', () => {
  it('renders the spec default: 46x46 rounded square with teal tone', async () => {
    const tree = await renderWithTheme(<Medallion label="✓" />);

    const style = containerStyleOf(tree);
    expect(style.width).toBe(46);
    expect(style.height).toBe(46);
    expect(style.borderRadius).toBe(14);
    expect(style.borderWidth).toBeUndefined();
    expect(style.backgroundColor).toBe(activeTheme.colors.accentSoft);

    const labelStyle = labelStyleOf(tree, '✓');
    expect(labelStyle.color).toBe(activeTheme.colors.primary);
  });

  it('renders the coral tone from the shared medallion pattern', async () => {
    const tree = await renderWithTheme(<Medallion label="✓" tone="coral" />);

    const style = containerStyleOf(tree);
    expect(style.backgroundColor).toBe(activeTheme.colors.secondarySoft);

    const labelStyle = labelStyleOf(tree, '✓');
    expect(labelStyle.color).toBe(activeTheme.colors.secondary);
  });

  it('renders the gold tone from the shared medallion pattern', async () => {
    const tree = await renderWithTheme(<Medallion label="✓" tone="gold" />);

    const style = containerStyleOf(tree);
    expect(style.backgroundColor).toBe(activeTheme.colors.tertiarySoft);

    const labelStyle = labelStyleOf(tree, '✓');
    expect(labelStyle.color).toBe(activeTheme.colors.tertiary);
  });

  it('respects an explicit size while keeping the spec radius', async () => {
    const tree = await renderWithTheme(<Medallion label="3" size={76} />);

    const style = containerStyleOf(tree);
    expect(style.width).toBe(76);
    expect(style.height).toBe(76);
    expect(style.borderRadius).toBe(14);
  });
});
