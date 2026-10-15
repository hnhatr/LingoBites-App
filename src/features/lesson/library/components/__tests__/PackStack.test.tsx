import React from 'react';
import {Pressable} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {PackStack, type StackCardA11y} from '../PackStack';

const ITEMS = ['a', 'b', 'c'];

function render(onPastEnd = jest.fn(), items = ITEMS, moreCount = 29) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <PackStack
            items={items}
            keyOf={item => item}
            moreCount={moreCount}
            onPastEnd={onPastEnd}
            renderCard={(item, _index, a11y: StackCardA11y) => (
              <Pressable
                {...a11y}
                onPress={jest.fn()}
                testID={`card-${item}`}
              />
            )}
            testID="stack"
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

/** The card a screen reader can reach: the top of the stack. */
function topCard(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root
    .findAll(
      node =>
        typeof node.props.testID === 'string' &&
        node.props.testID.startsWith('stack-card-') &&
        node.props.pointerEvents === 'auto',
    )
    .map(node => node.props.testID)[0];
}

function act11y(tree: ReactTestRenderer.ReactTestRenderer, name: string) {
  const card = tree.root
    .findAll(
      node =>
        typeof node.props.testID === 'string' &&
        node.props.testID.startsWith('card-') &&
        typeof node.props.onAccessibilityAction === 'function',
    )
    .find(node =>
      node.props.accessibilityActions.some(
        (action: {name: string}) => action.name === name,
      ),
    );
  act(() => {
    card?.props.onAccessibilityAction({nativeEvent: {actionName: name}});
  });
  act(() => {
    jest.runAllTimers();
  });
}

describe('PackStack', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts on the first card and draws every card', () => {
    const tree = render();
    expect(topCard(tree)).toBe('stack-card-0');
    for (const item of ITEMS) {
      expect(
        tree.root.findAllByProps({testID: `card-${item}`}),
      ).not.toHaveLength(0);
    }
  });

  it('moves to the next card and back', () => {
    const tree = render();
    act11y(tree, 'next');
    expect(topCard(tree)).toBe('stack-card-1');
    act11y(tree, 'previous');
    expect(topCard(tree)).toBe('stack-card-0');
  });

  it('only offers "previous" after the first card', () => {
    const tree = render();
    const names = (node: ReactTestRenderer.ReactTestInstance) =>
      node.props.accessibilityActions.map(
        (action: {name: string}) => action.name,
      );
    const first = tree.root
      .findAll(
        node =>
          node.props.testID === 'card-a' && node.props.accessibilityActions,
      )
      .at(0);
    expect(first && names(first)).toEqual(['next']);
  });

  it('opens the full list when swiping on past the last card', () => {
    const onPastEnd = jest.fn();
    const tree = render(onPastEnd);
    act11y(tree, 'next');
    act11y(tree, 'next');
    expect(onPastEnd).not.toHaveBeenCalled();
    expect(topCard(tree)).toBe('stack-card-2');
    act11y(tree, 'next');
    expect(onPastEnd).toHaveBeenCalledTimes(1);
    // Still on the last card when the user comes back.
    expect(topCard(tree)).toBe('stack-card-2');
  });

  it('shows how many items are left out after the dots', () => {
    const tree = render();
    expect(tree.root.findByProps({testID: 'stack-more'}).props.children).toBe(
      '+29',
    );
    const quiet = render(jest.fn(), ['a'], 0);
    expect(quiet.root.findAllByProps({testID: 'stack-dot-on'})).toHaveLength(0);
  });
});
