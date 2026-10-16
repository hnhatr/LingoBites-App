import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppProgressBar} from '@ui/components/AppProgressBar';
import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

function render(props: Partial<React.ComponentProps<typeof AppProgressBar>>) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <AppProgressBar
            fillTestID="bar-fill"
            testID="bar"
            value={0.25}
            {...props}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

function fillWidth(tree: ReactTestRenderer.ReactTestRenderer) {
  const fill = tree.root.find(
    node => node.props.testID === 'bar-fill' && Array.isArray(node.props.style),
  );
  return fill.props.style[2].width;
}

describe('AppProgressBar', () => {
  it('fills to the value and shows the count chip', () => {
    const tree = render({count: '3/12'});
    expect(fillWidth(tree)).toBe('25%');
    expect(
      tree.root.find(
        node => node.props.testID === 'bar-label' && node.props.children,
      ).props.children,
    ).toBe('3/12');
  });

  it('draws no fill at zero and clamps above one', () => {
    expect(
      render({value: 0}).root.findAll(node => node.props.testID === 'bar-fill'),
    ).toHaveLength(0);
    expect(fillWidth(render({value: 1.4}))).toBe('100%');
  });

  it('reports where the bar was tapped when it can seek', () => {
    const onSeek = jest.fn();
    const tree = render({onSeek});
    const bar = tree.root
      .findAll(node => node.props.testID === 'bar')
      .find(node => typeof node.props.onPress === 'function')!;
    act(() => bar.props.onLayout({nativeEvent: {layout: {width: 200}}}));
    act(() => bar.props.onPress({nativeEvent: {locationX: 150}}));
    expect(onSeek).toHaveBeenCalledWith(0.75);
    act(() => bar.props.onPress({nativeEvent: {locationX: 260}}));
    expect(onSeek).toHaveBeenLastCalledWith(0.9999);
  });
});
