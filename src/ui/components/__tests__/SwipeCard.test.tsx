import React from 'react';
import {Text} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {ProgressRing} from '../ProgressRing';
import {SwipeCard} from '../SwipeCard';

async function render(ui: React.ReactElement) {
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

function texts(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root
    .findAll(node => typeof node.props?.children === 'string')
    .map(node => node.props.children as string);
}

describe('SwipeCard', () => {
  it('renders its child plus hidden swipe stamps', async () => {
    const tree = await render(
      <SwipeCard enabled leftLabel="Quên" onSwipe={jest.fn()} rightLabel="Nhớ">
        <Text>card</Text>
      </SwipeCard>,
    );
    expect(texts(tree)).toEqual(
      expect.arrayContaining(['card', 'Nhớ', 'Quên']),
    );
    const stamps = tree.root.find(
      node =>
        node.props.accessibilityElementsHidden === true &&
        node.props.pointerEvents === 'none',
    );
    expect(stamps.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});

describe('ProgressRing', () => {
  it('exposes its value as a progressbar', async () => {
    const tree = await render(
      <ProgressRing
        accessibilityLabel="Đã nhớ 75% số thẻ"
        caption="đã nhớ"
        progress={0.75}
        testID="ring"
        value="75%"
      />,
    );
    const ring = tree.root.findAllByProps({
      testID: 'ring',
      accessibilityRole: 'progressbar',
    })[0];
    expect(ring.props.accessibilityValue).toEqual({min: 0, max: 100, now: 75});
    expect(texts(tree)).toEqual(expect.arrayContaining(['75%', 'đã nhớ']));
  });
});
