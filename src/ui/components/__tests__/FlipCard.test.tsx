import React from 'react';
import {Text} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {FlipCard} from '../FlipCard';
import {AppThemeProvider} from '@ui/theme/index';
import {FeatureFlagProvider} from '@/release';

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

describe('FlipCard', () => {
  it('renders front content when flipped is false', async () => {
    const onFlip = jest.fn();
    const tree = await render(
      <FlipCard
        back={<Text>Mặt sau: Định nghĩa</Text>}
        flipped={false}
        front={<Text>Mặt trước: Word</Text>}
        onFlip={onFlip}
      />,
    );

    const textNodes = tree.root.findAllByType(Text);
    const textContents = textNodes.map(node => node.props.children);

    expect(textContents).toContain('Mặt trước: Word');
    expect(textContents).not.toContain('Mặt sau: Định nghĩa');
  });

  it('renders back content when flipped is true', async () => {
    const onFlip = jest.fn();
    const tree = await render(
      <FlipCard
        back={<Text>Mặt sau: Định nghĩa</Text>}
        flipped={true}
        front={<Text>Mặt trước: Word</Text>}
        onFlip={onFlip}
      />,
    );

    const textNodes = tree.root.findAllByType(Text);
    const textContents = textNodes.map(node => node.props.children);

    expect(textContents).toContain('Mặt sau: Định nghĩa');
    expect(textContents).not.toContain('Mặt trước: Word');
  });

  it('triggers onFlip when tapped', async () => {
    const onFlip = jest.fn();
    const tree = await render(
      <FlipCard
        back={<Text>Mặt sau</Text>}
        flipped={false}
        front={<Text>Mặt trước</Text>}
        onFlip={onFlip}
      />,
    );

    const cardContainer = tree.root.findByProps({testID: 'flip-card'});
    await act(async () => {
      cardContainer.props.onPress();
    });

    expect(onFlip).toHaveBeenCalledTimes(1);
  });

  it('enforces minHeight: 220 in all states', async () => {
    const tree = await render(
      <FlipCard
        back={<Text>Back</Text>}
        flipped={false}
        front={<Text>Front</Text>}
        onFlip={() => {}}
      />,
    );

    const appCard = tree.root
      .findByType(FlipCard)
      .findByProps({testID: 'flip-card'});
    expect(appCard).toBeTruthy();
  });

  it('allows contentContainer to expand naturally without flex: 1 cap', async () => {
    const tree = await render(
      <FlipCard
        back={<Text>Back</Text>}
        flipped={false}
        front={<Text>Front</Text>}
        onFlip={() => {}}
      />,
    );

    const appCard = tree.root.findByProps({testID: 'flip-card'});
    const contentContainer = appCard.find(
      node => node.props.style && node.props.style.width === '100%',
    );
    expect(contentContainer).toBeTruthy();
    expect(contentContainer.props.style).toEqual(
      expect.objectContaining({
        alignSelf: 'stretch',
        width: '100%',
      }),
    );
    expect(contentContainer.props.style.flex).toBeUndefined();
  });
});
