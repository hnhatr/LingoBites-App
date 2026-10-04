import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {ConsentSheet} from '../ConsentSheet';

function renderSheet(
  props: Partial<React.ComponentProps<typeof ConsentSheet>>,
) {
  const onDismiss = jest.fn();
  const onChooseUploadOn = jest.fn();
  const onChooseLocalOnly = jest.fn();
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider releaseConfig={{releaseName: 'test', features: {}}}>
        <AppThemeProvider>
          <ConsentSheet
            onChooseLocalOnly={onChooseLocalOnly}
            onChooseUploadOn={onChooseUploadOn}
            onDismiss={onDismiss}
            visible={true}
            {...props}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return {tree, onDismiss, onChooseUploadOn, onChooseLocalOnly};
}

function pressByTestId(
  root: ReactTestRenderer.ReactTestInstance,
  testID: string,
) {
  const node = root.findByProps({testID});
  act(() => {
    node.props.onPress();
  });
}

describe('ConsentSheet', () => {
  it('AC-015 S2: choosing local only invokes the local-only handler', () => {
    const {tree, onChooseLocalOnly} = renderSheet({});
    pressByTestId(tree.root, 'shadowing-consent-local-only');
    expect(onChooseLocalOnly).toHaveBeenCalledTimes(1);
  });

  it('AC-015 S1: dismiss does not choose upload', () => {
    const {tree, onDismiss, onChooseUploadOn} = renderSheet({});
    pressByTestId(tree.root, 'shadowing-consent-backdrop');
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onChooseUploadOn).not.toHaveBeenCalled();
  });
});
