import React from 'react';
import {StyleSheet} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppProgressBar} from '@ui/components/AppProgressBar';
import {AppThemeProvider} from '@ui/theme';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import {FeatureFlagProvider} from '@core/release';

function render(props: Partial<React.ComponentProps<typeof AppProgressBar>>) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <AppProgressBar testID="bar" total={9} {...props} />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

/** Background colour of each note, left to right. */
function noteColors(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root
    .findAll(
      node =>
        typeof node.type === 'string' &&
        StyleSheet.flatten(node.props.style)?.height === 12,
    )
    .map(node => StyleSheet.flatten(node.props.style).backgroundColor);
}

describe('AppProgressBar', () => {
  it('draws one note per item: done, the open one coral, then upcoming', () => {
    const tree = render({current: 2, count: '3/9'});
    const colors = noteColors(tree);
    expect(colors).toHaveLength(9);
    expect(colors[2]).toBe(HERO_PALETTE.coral);
    expect(colors[0]).toBe(colors[1]);
    expect(colors[0]).not.toBe(colors[3]);
    expect(
      tree.root.find(
        node => node.props.testID === 'bar-label' && node.props.children,
      ).props.children,
    ).toBe('3/9');
  });

  it('groups long lists into at most twenty notes', () => {
    expect(noteColors(render({total: 45, current: 16}))).toHaveLength(15);
  });

  it('jumps to the first item of the tapped note', () => {
    const onSelect = jest.fn();
    const tree = render({total: 45, current: 0, onSelect});
    const bar = tree.root
      .findAll(node => node.props.testID === 'bar')
      .find(node => typeof node.props.onPress === 'function')!;
    act(() => bar.props.onLayout({nativeEvent: {layout: {width: 300}}}));
    act(() => bar.props.onPress({nativeEvent: {locationX: 100}}));
    // 15 notes of 3 items: x=100 is note 5, which starts at item 15.
    expect(onSelect).toHaveBeenCalledWith(15);
  });
});
