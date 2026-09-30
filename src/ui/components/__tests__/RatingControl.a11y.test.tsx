import React from 'react';
import {StyleSheet} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import type {AppTheme} from '@ui/theme';
import {AppThemeProvider, useAppTheme} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {
  findMaskedContent,
  hasIconAndTextLabel,
} from '../../../../test-utils/a11yTestUtils';
import {RatingControl} from '../RatingControl';

const RATING_BUTTONS = [
  {testID: 'rating-remembered', label: 'Đã nhớ - lên lịch ôn sau'},
  {testID: 'rating-forgot', label: 'Không nhớ - ôn lại sau 1 ngày'},
];

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

describe('RatingControl - Accessibility (NFR-ACC-004)', () => {
  const mockHandlers = {
    onRate: jest.fn(),
    onSkip: jest.fn(),
  };

  it('has accessibility labels for all buttons', async () => {
    const tree = await render(
      <RatingControl
        onRate={mockHandlers.onRate}
        onSkip={mockHandlers.onSkip}
      />,
    );

    const skipButton = tree.root.findByProps({testID: 'rating-skip'});
    expect(skipButton.props.accessibilityLabel).toBe('Bỏ qua thẻ này');

    for (const button of RATING_BUTTONS) {
      const node = tree.root.findByProps({testID: button.testID});
      expect(node.props.accessibilityLabel).toBe(button.label);
    }
  });

  it('has no unreviewed accessibility-label candidates beyond the known paraphrase (SETE-122)', async () => {
    const tree = await render(
      <RatingControl
        onRate={mockHandlers.onRate}
        onSkip={mockHandlers.onSkip}
      />,
    );

    // findMaskedContent can't judge semantic equivalence: it flags any
    // visible text that isn't a literal substring of the accessibilityLabel.
    // The "forgot" button intentionally paraphrases "Quên" as "Không nhớ -
    // ôn lại sau 1 ngày" (rating.forgot_label vs rating.forgot_a11y in
    // src/core/i18n/vi.json) — a richer description, not lost content, confirmed
    // by manual reading during the SETE-122 audit. If this list grows
    // beyond that one known case, a new candidate needs the same manual
    // review before being added here.
    const masked = findMaskedContent(tree.root);
    expect(masked.map(node => node.label)).toEqual([
      'Không nhớ - ôn lại sau 1 ngày',
    ]);
  });

  it('has accessibility roles for all buttons', async () => {
    const tree = await render(
      <RatingControl
        onRate={mockHandlers.onRate}
        onSkip={mockHandlers.onSkip}
      />,
    );

    const skipButton = tree.root.findByProps({testID: 'rating-skip'});
    expect(skipButton.props.accessibilityRole).toBe('button');

    for (const button of RATING_BUTTONS) {
      const node = tree.root.findByProps({testID: button.testID});
      expect(node.props.accessibilityRole).toBe('button');
    }
  });

  it('has icon+text label pairing for all buttons (NFR-ACC-004)', async () => {
    const tree = await render(
      <RatingControl
        onRate={mockHandlers.onRate}
        onSkip={mockHandlers.onSkip}
      />,
    );

    const skipButton = tree.root.findByProps({testID: 'rating-skip'});
    const skipCheck = hasIconAndTextLabel(skipButton);
    expect(skipCheck.passes).toBe(true);
    expect(skipCheck.hasIcon).toBe(true);
    expect(skipCheck.hasText).toBe(true);

    for (const button of RATING_BUTTONS) {
      const node = tree.root.findByProps({testID: button.testID});
      const check = hasIconAndTextLabel(node);
      expect(check.passes).toBe(true);
      expect(check.hasIcon).toBe(true);
      expect(check.hasText).toBe(true);
    }
  });

  it('keeps disabled buttons readable with no opacity wash (SETE-254)', async () => {
    let activeTheme!: AppTheme;
    function Probe() {
      activeTheme = useAppTheme().theme;
      return null;
    }

    const enabledTree = await render(
      <>
        <RatingControl
          onRate={mockHandlers.onRate}
          onSkip={mockHandlers.onSkip}
        />
        <Probe />
      </>,
    );
    const disabledTree = await render(
      <RatingControl
        disabled={true}
        onRate={mockHandlers.onRate}
        onSkip={mockHandlers.onSkip}
      />,
    );

    for (const testID of [
      'rating-remembered',
      'rating-forgot',
      'rating-skip',
    ]) {
      const enabledStyle = StyleSheet.flatten(
        enabledTree.root.findByProps({testID}).props.style,
      );
      const disabledStyle = StyleSheet.flatten(
        disabledTree.root.findByProps({testID}).props.style,
      );

      // The bug mechanism: a whole-button opacity wash collapses glyph
      // contrast to ~1.7-2.0:1. Disabled buttons must render at full opacity.
      expect(disabledStyle.opacity ?? 1).toBe(1);
      // ... on an explicitly muted fill that still differs from the
      // enabled treatment, so the inactive state stays signalled.
      expect(disabledStyle.backgroundColor).toBe(
        activeTheme.colors.surfaceMuted,
      );
      expect(disabledStyle.backgroundColor).not.toBe(
        enabledStyle.backgroundColor,
      );
    }

    // Label ink stays at full-strength secondary in the disabled state
    // (secondary on surfaceMuted is >=3:1 on every theme — see the
    // contrastCompliance suite), instead of a washed-out tone. The skip
    // label carries its color internally (no style prop on the wrapper),
    // so only nodes that resolve a color participate.
    for (const label of ['Nhớ', 'Quên', 'Bỏ qua']) {
      const nodes = disabledTree.root.findAllByProps({children: label});
      const colors = nodes
        .map(node => StyleSheet.flatten(node.props.style)?.color)
        .filter(color => color !== undefined);
      expect(colors.length).toBeGreaterThan(0);
      for (const color of colors) {
        expect(color).toBe(activeTheme.colors.text.secondary);
      }
    }
  });

  it('respects disabled state for accessibility', async () => {
    const tree = await render(
      <RatingControl
        disabled={true}
        onRate={mockHandlers.onRate}
        onSkip={mockHandlers.onSkip}
      />,
    );

    const skipButton = tree.root.findByProps({testID: 'rating-skip'});
    expect(skipButton.props.disabled).toBe(true);
    expect(skipButton.props.accessibilityState).toEqual({disabled: true});

    for (const button of RATING_BUTTONS) {
      const node = tree.root.findByProps({testID: button.testID});
      expect(node.props.disabled).toBe(true);
      expect(node.props.accessibilityState).toEqual({disabled: true});
    }
  });
});
