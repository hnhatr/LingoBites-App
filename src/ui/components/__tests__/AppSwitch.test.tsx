import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppSwitch} from '@ui/components/AppSwitch';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

function render(props: Partial<React.ComponentProps<typeof AppSwitch>>) {
  const onValueChange = jest.fn();
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <AppSwitch
            accessibilityLabel="Tiếng Việt"
            onValueChange={onValueChange}
            testID="switch"
            value={false}
            {...props}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  const button = tree.root
    .findAll(node => node.props.testID === 'switch')
    .find(node => typeof node.props.onPress === 'function')!;
  return {tree, button, onValueChange};
}

describe('AppSwitch', () => {
  it('reads as a switch with its on/off state', () => {
    const off = render({}).button;
    expect(off.props.accessibilityRole).toBe('switch');
    expect(off.props.accessibilityState).toEqual({
      checked: false,
      disabled: false,
    });
    expect(render({value: true}).button.props.accessibilityState.checked).toBe(
      true,
    );
  });

  it('flips the value on press', () => {
    const {button, onValueChange} = render({value: true});
    act(() => button.props.onPress());
    expect(onValueChange).toHaveBeenCalledWith(false);
  });

  it('shows a tick on the thumb only while on', () => {
    expect(render({}).tree.root.findAllByType(MaterialIcon)).toHaveLength(0);
    expect(
      render({value: true}).tree.root.findByType(MaterialIcon).props.name,
    ).toBe('check');
  });
});
