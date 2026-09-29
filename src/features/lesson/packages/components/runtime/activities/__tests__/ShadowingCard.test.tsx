import React from 'react';
import {StyleSheet} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {FeatureFlagProvider} from '@core/release/index';
import {AppThemeProvider} from '@ui/theme/index';
import {AppButton} from '@ui/components/AppButton';
import {IconButton} from '@ui/components/IconButton';
import {ShadowingCard} from '../ShadowingCard';

const data = {
  kind: 'shadowing' as const,
  titleVi: 'Nghe từng câu mẫu và lặp lại thật rõ ràng',
  instructionsVi: 'Nghe từng câu mẫu và lặp lại thật rõ ràng',
  lines: [
    {
      textEn:
        'What do you mean by edge cases here, and can you elaborate on the business logic?',
      textVi: 'Câu mẫu dài',
      audioAssetId: 'audio-1',
    },
  ],
};

function renderCard() {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <ShadowingCard
            data={data}
            onComplete={jest.fn()}
            onPlayAudio={jest.fn()}
            onSkip={jest.fn()}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

describe('ShadowingCard', () => {
  it('wraps long sentences while keeping the audio control in the card', () => {
    const tree = renderCard();

    const lineText = tree.root.findByProps({testID: 'shadowing-line-en-0'});
    expect(StyleSheet.flatten(lineText.props.style)).toMatchObject({
      flex: 1,
      flexShrink: 1,
    });
    const audioButtons = tree.root.findAllByType(IconButton);
    expect(audioButtons).toHaveLength(1);
    expect(StyleSheet.flatten(audioButtons[0]?.props.style)).toMatchObject({
      flexShrink: 0,
    });
  });

  it('exposes the repeat confirmation as a button with selected state (SETE-265)', () => {
    const tree = renderCard();

    const confirmHosts = tree.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props.testID === 'shadowing-confirm' &&
        node.props.accessibilityRole === 'button',
    );
    expect(confirmHosts).toHaveLength(1);

    const confirmButton = tree.root
      .findAllByType(AppButton)
      .find(node => node.props.testID === 'shadowing-confirm');
    expect(confirmButton?.props.accessibilityState).toMatchObject({
      selected: false,
    });

    act(() => {
      confirmButton?.props.onPress();
    });

    const pressedButton = tree.root
      .findAllByType(AppButton)
      .find(node => node.props.testID === 'shadowing-confirm');
    expect(pressedButton?.props.title).toBe('✓ Tôi đã lặp lại');
    expect(pressedButton?.props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it('renders no duplicate accessibility identifiers on one step (SETE-265)', () => {
    const tree = renderCard();
    const ids = tree.root
      .findAll(
        node =>
          typeof node.type === 'string' &&
          typeof node.props?.testID === 'string',
      )
      .map(node => node.props.testID as string);

    expect(ids).toContain('shadowing-confirm');
    expect(ids).toContain('lesson-step-complete');
    expect(ids).toContain('lesson-step-skip');
    expect(new Set(ids).size).toBe(ids.length);
  });
});
