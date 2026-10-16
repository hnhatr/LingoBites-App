import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {MaterialIcon} from '@ui/components/MaterialIcon';
import {SaveToggle} from '@ui/components/SaveToggle';
import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

function render(props: Partial<React.ComponentProps<typeof SaveToggle>>) {
  const onPress = jest.fn();
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <SaveToggle
            onPress={onPress}
            saved={false}
            testID="save"
            {...props}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  const button = tree.root
    .findAll(node => node.props.testID === 'save')
    .find(node => node.type !== SaveToggle)!;
  return {tree, button, onPress};
}

describe('SaveToggle', () => {
  it('shows "bookmark +" while unsaved and a filled bookmark once saved', () => {
    expect(render({}).tree.root.findByType(MaterialIcon).props.name).toBe(
      'bookmark_add',
    );
    expect(
      render({saved: true}).tree.root.findByType(MaterialIcon).props.name,
    ).toBe('bookmark');
  });

  it('reads a lesson label by default and toggles on press', () => {
    const {button, onPress} = render({});
    expect(button.props.accessibilityLabel).toBe('Lưu bài');
    expect(button.props.accessibilityState).toEqual({selected: false});
    act(() => button.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(render({saved: true}).button.props.accessibilityLabel).toBe(
      'Bỏ lưu bài',
    );
  });

  it('sits on a white square only when asked', () => {
    const face = (backdrop: boolean) =>
      render({backdrop})
        .button.props.style({pressed: false})
        .some((style: {backgroundColor?: string} | null) =>
          Boolean(style?.backgroundColor),
        );
    expect(face(false)).toBe(false);
    expect(face(true)).toBe(true);
  });
});
