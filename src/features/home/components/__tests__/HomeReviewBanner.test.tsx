import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {HomeReviewBanner} from '../HomeReviewBanner';

function render(ui: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>{ui}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

describe('HomeReviewBanner', () => {
  it('shows the due count and opens review on press', () => {
    const onPress = jest.fn();
    const tree = render(<HomeReviewBanner count={3} onPress={onPress} />);
    const banner = tree.root.findByProps({testID: 'home-review-banner'});

    expect(banner.props.accessibilityLabel).toContain('3');
    expect(
      tree.root.findAllByProps({children: '3 thẻ đến hạn'}).length,
    ).toBeGreaterThan(0);
    act(() => banner.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
