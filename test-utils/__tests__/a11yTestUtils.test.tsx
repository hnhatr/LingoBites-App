/* eslint-disable react-native-a11y/has-accessibility-hint */
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {Pressable, Text, View} from 'react-native';
import {
  findMaskedContent,
  getAnnouncedText,
  hasIconAndTextLabel,
  warnOnMaskedContent,
} from '../a11yTestUtils';
import {MaterialIcon} from '../../src/ui/components/MaterialIcon';
import {AppThemeProvider} from '../../src/ui/theme';
import {FeatureFlagProvider} from '../../src/core/release';

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

describe('a11yTestUtils', () => {
  it('detects React Native text children inside icon buttons', async () => {
    const tree = await render(
      <View testID="icon-text-button">
        <MaterialIcon name="check_circle" />
        <Text>Đã nhớ</Text>
      </View>,
    );

    expect(hasIconAndTextLabel(tree.root).hasText).toBe(true);
  });
});

describe('getAnnouncedText', () => {
  it('rule 1: accessibilityLabel REPLACES descendant text when accessible (Pressable default, no explicit `accessible` prop)', async () => {
    const tree = await render(
      <Pressable accessibilityLabel="Mặt trước flashcard" testID="target">
        <Text>hello</Text>
      </Pressable>,
    );

    const target = tree.root.findByProps({testID: 'target'});
    expect(target.props.accessible).toBeUndefined();
    expect(getAnnouncedText(target)).toBe('Mặt trước flashcard');
  });

  it('rule 2: concatenates descendant Text content when accessible with no label', async () => {
    const tree = await render(
      <View accessible={true} testID="target">
        <Text>hello</Text>
        <Text>world</Text>
      </View>,
    );

    const target = tree.root.findByProps({testID: 'target'});
    expect(getAnnouncedText(target)).toBe('hello world');
  });

  it('rule 3: announces nothing when importantForAccessibility="no-hide-descendants"', async () => {
    const tree = await render(
      <View
        accessible={true}
        importantForAccessibility="no-hide-descendants"
        testID="target"
      >
        <Text>hidden</Text>
      </View>,
    );

    const target = tree.root.findByProps({testID: 'target'});
    expect(getAnnouncedText(target)).toBe('');
  });

  it('rule 3: announces nothing when accessibilityElementsHidden is true', async () => {
    const tree = await render(
      <View accessibilityElementsHidden={true} testID="target">
        <Text>hidden</Text>
      </View>,
    );

    const target = tree.root.findByProps({testID: 'target'});
    expect(getAnnouncedText(target)).toBe('');
  });

  it('rule 4: appends accessibilityValue.text', async () => {
    const tree = await render(
      <View
        accessible={true}
        accessibilityLabel="Volume"
        accessibilityValue={{text: '50%'}}
        testID="target"
      />,
    );

    const target = tree.root.findByProps({testID: 'target'});
    expect(getAnnouncedText(target)).toBe('Volume 50%');
  });
});

describe('findMaskedContent', () => {
  it('flags a Pressable whose static label masks real Text content (FlipCard-shaped bug)', async () => {
    const tree = await render(
      <Pressable accessibilityLabel="Mặt trước flashcard" testID="flip-card">
        <Text>hello</Text>
      </Pressable>,
    );

    const masked = findMaskedContent(tree.root);
    expect(masked).toHaveLength(1);
    expect(masked[0].label).toBe('Mặt trước flashcard');
    expect(masked[0].maskedText).toEqual(['hello']);
  });

  it('does not flag a label that already contains the visible text (QuizOption-shaped, safe)', async () => {
    const label = 'con mèo';
    const tree = await render(
      <Pressable accessibilityLabel={label} testID="quiz-option">
        <Text>{label}</Text>
      </Pressable>,
    );

    expect(findMaskedContent(tree.root)).toHaveLength(0);
  });

  it('does not flag content that is not accessible (accessible=false)', async () => {
    const tree = await render(
      <Pressable
        accessible={false}
        accessibilityLabel="label only"
        testID="target"
      >
        <Text>hello</Text>
      </Pressable>,
    );

    expect(findMaskedContent(tree.root)).toHaveLength(0);
  });

  it('does not flag a label that re-cases the same visible word (RatingControl-shaped, safe)', async () => {
    // e.g. label="Đã nhớ - lên lịch ôn sau", visible text="Nhớ" — same word,
    // capitalized differently because it's a standalone tag rather than
    // mid-sentence. Screen readers pronounce it identically either way.
    const tree = await render(
      <Pressable
        accessibilityLabel="Đã nhớ - lên lịch ôn sau"
        testID="rating-remembered"
      >
        <Text>Nhớ</Text>
      </Pressable>,
    );

    expect(findMaskedContent(tree.root)).toHaveLength(0);
  });
});

describe('warnOnMaskedContent', () => {
  it('logs a readable report via console.warn when masking is found, without throwing', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const tree = await render(
      <Pressable accessibilityLabel="Mặt trước flashcard" testID="flip-card">
        <Text>hello</Text>
      </Pressable>,
    );

    expect(() =>
      warnOnMaskedContent(tree.root, 'FlipCard (test)'),
    ).not.toThrow();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0];
    expect(message).toContain('FlipCard (test)');
    expect(message).toContain('Mặt trước flashcard');
    expect(message).toContain('hello');

    warnSpy.mockRestore();
  });

  it('does not log anything when no masking is found', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const label = 'con mèo';
    const tree = await render(
      <Pressable accessibilityLabel={label} testID="quiz-option">
        <Text>{label}</Text>
      </Pressable>,
    );

    warnOnMaskedContent(tree.root, 'QuizOption (test)');

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
