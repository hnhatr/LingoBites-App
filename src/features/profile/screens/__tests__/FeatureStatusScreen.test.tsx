import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {FeatureFlagProvider} from '@/release';
import {AppThemeProvider} from '@ui/theme/index';
import {FeatureStatusScreen} from '../FeatureStatusScreen';

function renderFeatureStatusScreen() {
  return ReactTestRenderer.create(
    <FeatureFlagProvider>
      <AppThemeProvider>
        <FeatureStatusScreen />
      </AppThemeProvider>
    </FeatureFlagProvider>,
  );
}

describe('FeatureStatusScreen', () => {
  it('renders the feature status header without theme errors', async () => {
    const tree = renderFeatureStatusScreen();
    await ReactTestRenderer.act(async () => {});

    expect(tree.root.findByProps({children: 'Feature Status'})).toBeTruthy();
  });
});
