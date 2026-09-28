import React from 'react';
import {StyleSheet} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {FeatureFlagProvider} from '@core/release/index';
import {makeTestReleaseConfig, CORE_WITH_REVIEW} from '@test/support/index';
import {AppThemeProvider} from '@ui/theme/index';
import {Banner} from '../Banner';
import {RatingControl} from '../RatingControl';

async function render(ui: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(CORE_WITH_REVIEW)}
      >
        <AppThemeProvider>{ui}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

describe('RatingControl', () => {
  it('calls both rating callbacks plus skip from icon-labeled controls', async () => {
    const onRate = jest.fn();
    const onSkip = jest.fn();
    const tree = await render(
      <RatingControl onRate={onRate} onSkip={onSkip} />,
    );

    const ratings = ['remembered', 'forgot'];
    for (const rating of ratings) {
      await act(async () => {
        tree.root.findByProps({testID: `rating-${rating}`}).props.onPress();
      });
    }
    await act(async () => {
      tree.root.findByProps({testID: 'rating-skip'}).props.onPress();
    });

    expect(onRate).toHaveBeenNthCalledWith(1, 'remembered');
    expect(onRate).toHaveBeenNthCalledWith(2, 'forgot');
    expect(onSkip).toHaveBeenCalledTimes(1);

    expect(tree.root.findAllByProps({children: 'Nhớ'}).length).toBeGreaterThan(
      0,
    );
    expect(tree.root.findAllByProps({children: 'Quên'}).length).toBeGreaterThan(
      0,
    );
    expect(
      tree.root.findAllByProps({children: 'Bỏ qua'}).length,
    ).toBeGreaterThan(0);
  });

  it('uses neutral styling for the forgot outcome', async () => {
    const tree = await render(
      <RatingControl onRate={jest.fn()} onSkip={jest.fn()} />,
    );
    const forgot = tree.root.findByProps({testID: 'rating-forgot'});
    const flattenedStyle = StyleSheet.flatten(forgot.props.style);

    expect(flattenedStyle.backgroundColor).not.toBe('#ba1a1a');
    expect(flattenedStyle.backgroundColor).not.toBe('#fe7488');
    expect(flattenedStyle.borderColor).toBeTruthy();
  });
});

describe('Banner', () => {
  it('shows the carry-over message with label-sized neutral styling', async () => {
    const tree = await render(
      <Banner message="còn 4 thẻ để dành lần ôn sau" variant="neutral" />,
    );

    expect(
      tree.root.findAllByProps({children: 'còn 4 thẻ để dành lần ôn sau'})
        .length,
    ).toBeGreaterThan(0);
    expect(tree.root.findByProps({testID: 'review-banner'})).toBeTruthy();
  });
});
