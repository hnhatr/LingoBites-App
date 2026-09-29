import React from 'react';
import {Text} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {FlipCard} from '../FlipCard';
import {AppThemeProvider} from '@ui/theme';
import {FeatureFlagProvider} from '@core/release';
import {
  findMaskedContent,
  getAnnouncedText,
} from '../../../../test-utils/a11yTestUtils';

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

describe('FlipCard - Accessibility', () => {
  it('announces front and back content based on flip state', async () => {
    const tree = await render(
      <FlipCard
        back={<Text>Back content</Text>}
        flipped={false}
        front={<Text>Front content</Text>}
        onFlip={jest.fn()}
      />,
    );

    const cardButton = tree.root.findByProps({testID: 'flip-card'});
    expect(getAnnouncedText(cardButton)).toBe('Front content Mặt trước');

    const flippedTree = await render(
      <FlipCard
        back={<Text>Back content</Text>}
        flipped={true}
        front={<Text>Front content</Text>}
        onFlip={jest.fn()}
      />,
    );

    const flippedCardButton = flippedTree.root.findByProps({
      testID: 'flip-card',
    });
    expect(getAnnouncedText(flippedCardButton)).toBe('Back content Mặt sau');
  });

  it('has accessibility hint for flip action', async () => {
    const tree = await render(
      <FlipCard
        back={<Text>Back content</Text>}
        flipped={false}
        front={<Text>Front content</Text>}
        onFlip={jest.fn()}
      />,
    );

    const cardButton = tree.root.findByProps({testID: 'flip-card'});
    expect(cardButton.props.accessibilityHint).toBe('Chạm để lật thẻ');
  });

  it('has accessibility role set to button', async () => {
    const tree = await render(
      <FlipCard
        back={<Text>Back content</Text>}
        flipped={false}
        front={<Text>Front content</Text>}
        onFlip={jest.fn()}
      />,
    );

    const cardButton = tree.root.findByProps({testID: 'flip-card'});
    expect(cardButton.props.accessibilityRole).toBe('button');
  });

  it('has accessibilityState.expanded reflecting flip state', async () => {
    const tree = await render(
      <FlipCard
        back={<Text>Back content</Text>}
        flipped={false}
        front={<Text>Front content</Text>}
        onFlip={jest.fn()}
      />,
    );

    const cardButton = tree.root.findByProps({testID: 'flip-card'});
    expect(cardButton.props.accessibilityState).toEqual({expanded: false});

    const flippedTree = await render(
      <FlipCard
        back={<Text>Back content</Text>}
        flipped={true}
        front={<Text>Front content</Text>}
        onFlip={jest.fn()}
      />,
    );

    const flippedCardButton = flippedTree.root.findByProps({
      testID: 'flip-card',
    });
    expect(flippedCardButton.props.accessibilityState).toEqual({
      expanded: true,
    });
  });

  it('has accessibilityValue indicating front or back face', async () => {
    const tree = await render(
      <FlipCard
        back={<Text>Back content</Text>}
        flipped={false}
        front={<Text>Front content</Text>}
        onFlip={jest.fn()}
      />,
    );

    const cardButton = tree.root.findByProps({testID: 'flip-card'});
    expect(cardButton.props.accessibilityValue).toEqual({text: 'Mặt trước'});

    const flippedTree = await render(
      <FlipCard
        back={<Text>Back content</Text>}
        flipped={true}
        front={<Text>Front content</Text>}
        onFlip={jest.fn()}
      />,
    );

    const flippedCardButton = flippedTree.root.findByProps({
      testID: 'flip-card',
    });
    expect(flippedCardButton.props.accessibilityValue).toEqual({
      text: 'Mặt sau',
    });
  });

  it('announces the card content to screen readers, not just a static label', async () => {
    const tree = await render(
      <FlipCard
        back={<Text>Back content</Text>}
        flipped={false}
        front={<Text>hello</Text>}
        onFlip={jest.fn()}
      />,
    );

    const cardButton = tree.root.findByProps({testID: 'flip-card'});
    expect(getAnnouncedText(cardButton)).toContain('hello');
  });

  it('flags FlipCard as masking its front content (SETE-122 known bug)', async () => {
    const tree = await render(
      <FlipCard
        back={<Text>Back content</Text>}
        flipped={false}
        front={<Text>hello</Text>}
        onFlip={jest.fn()}
      />,
    );

    const masked = findMaskedContent(tree.root);
    expect(masked.some(node => node.maskedText.includes('hello'))).toBe(false);
  });

  it('triggers onFlip when pressed (supports screen reader double-tap)', async () => {
    const onFlip = jest.fn();
    const tree = await render(
      <FlipCard
        back={<Text>Back content</Text>}
        flipped={false}
        front={<Text>Front content</Text>}
        onFlip={onFlip}
      />,
    );

    const cardButton = tree.root.findByProps({testID: 'flip-card'});
    await act(async () => {
      cardButton.props.onPress();
    });

    expect(onFlip).toHaveBeenCalledTimes(1);
  });
});
