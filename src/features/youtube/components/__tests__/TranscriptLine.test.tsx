import React from 'react';
import renderer, {act, type ReactTestInstance} from 'react-test-renderer';
import {FeatureFlagProvider} from '@/release';
import {AppThemeProvider} from '@ui/theme/index';
import type {YouTubeSegment} from '@shared/schemas/youtube-transcript-v1';
import {TranscriptLine} from '../TranscriptLine';

const LINE_TEST_ID = 'transcript-line-seg-0';

/**
 * The `testID` lives on the outer wrapper `View`, so locate the inner
 * `Pressable` by capability: it is the only node that owns both the real
 * `onPress` and an `accessibilityState`.
 */
function findPressable(tree: renderer.ReactTestRenderer): ReactTestInstance {
  const matches = tree.root.findAll(
    node =>
      typeof node.props?.onPress === 'function' &&
      node.props?.accessibilityState !== undefined,
  );
  return matches[0];
}

function makeSegment(overrides: Partial<YouTubeSegment> = {}): YouTubeSegment {
  return {
    id: 'seg-0',
    index: 0,
    start_ms: 1_000,
    end_ms: 3_000,
    en: 'Hello there',
    vi: 'Xin chào',
    ipa: 'həˈloʊ ðɛr',
    ...overrides,
  };
}

function renderLine(
  props: Partial<React.ComponentProps<typeof TranscriptLine>> = {},
) {
  const onPress = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <TranscriptLine
            isActive={false}
            onPress={onPress}
            segment={makeSegment()}
            showIpa
            showVietnamese
            testID={LINE_TEST_ID}
            {...props}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return {tree, onPress};
}

describe('TranscriptLine', () => {
  it('renders English, Vietnamese, and IPA lines when translation is shown', () => {
    const {tree} = renderLine();

    expect(
      tree.root.findByProps({testID: 'transcript-line-seg-0-en'}).props
        .children,
    ).toBe('Hello there');
    expect(
      tree.root.findByProps({testID: 'transcript-line-seg-0-vi'}).props
        .children,
    ).toBe('Xin chào');
    expect(
      tree.root.findByProps({testID: 'transcript-line-seg-0-ipa'}).props
        .children,
    ).toBe('/həˈloʊ ðɛr/');
  });

  it('hides Vietnamese and IPA independently', () => {
    const {tree} = renderLine({showVietnamese: false, showIpa: true});
    expect(() =>
      tree.root.findByProps({testID: 'transcript-line-seg-0-vi'}),
    ).toThrow();
    expect(
      tree.root.findByProps({testID: 'transcript-line-seg-0-ipa'}).props
        .children,
    ).toBe('/həˈloʊ ðɛr/');

    const ipaOff = renderLine({showVietnamese: true, showIpa: false}).tree;
    expect(() =>
      ipaOff.root.findByProps({testID: 'transcript-line-seg-0-ipa'}),
    ).toThrow();
  });

  it('hides both lines when Vietnamese and IPA are off', () => {
    const {tree} = renderLine({showVietnamese: false, showIpa: false});

    expect(() =>
      tree.root.findByProps({testID: 'transcript-line-seg-0-vi'}),
    ).toThrow();
    expect(() =>
      tree.root.findByProps({testID: 'transcript-line-seg-0-ipa'}),
    ).toThrow();
  });

  it('calls onPress with the segment when tapped', () => {
    const {tree, onPress} = renderLine();

    act(() => {
      findPressable(tree).props.onPress();
    });

    expect(onPress).toHaveBeenCalledWith(makeSegment());
  });

  it('marks the active line as selected', () => {
    const {tree} = renderLine({isActive: true});

    expect(findPressable(tree).props.accessibilityState).toEqual({
      selected: true,
    });
  });

  it('disables the pressable surface while keeping the transcript readable', () => {
    const {tree} = renderLine({disabled: true});

    const pressable = findPressable(tree);
    expect(pressable.props.disabled).toBe(true);
    expect(pressable.props.accessibilityState).toEqual({
      selected: false,
      disabled: true,
    });

    expect(
      tree.root.findByProps({testID: 'transcript-line-seg-0-en'}).props
        .children,
    ).toBe('Hello there');
    expect(
      tree.root.findByProps({testID: 'transcript-line-seg-0-vi'}).props
        .children,
    ).toBe('Xin chào');
    expect(
      tree.root.findByProps({testID: 'transcript-line-seg-0-ipa'}).props
        .children,
    ).toBe('/həˈloʊ ðɛr/');
  });

  it('reports the tapped word when onPressWord is set (SETE-325, C-2)', () => {
    const onPressWord = jest.fn();
    const {tree} = renderLine({onPressWord});

    act(() => {
      tree.root
        .findByProps({testID: 'transcript-line-seg-0-word-0'})
        .props.onPress();
    });
    expect(onPressWord).toHaveBeenCalledWith('Hello');

    act(() => {
      tree.root
        .findByProps({testID: 'transcript-line-seg-0-word-2'})
        .props.onPress();
    });
    expect(onPressWord).toHaveBeenCalledWith('there');
  });

  it('renders plain English text with no tappable words by default', () => {
    const {tree} = renderLine();

    expect(
      tree.root.findByProps({testID: 'transcript-line-seg-0-en'}).props
        .children,
    ).toBe('Hello there');
    expect(
      tree.root.findAll(
        node =>
          typeof node.props?.testID === 'string' &&
          node.props.testID.includes('-word-'),
      ),
    ).toHaveLength(0);
    expect(() =>
      tree.root.findByProps({testID: 'transcript-line-seg-0-practice'}),
    ).toThrow();
  });

  it('keeps words untappable while disabled even with onPressWord set', () => {
    const {tree} = renderLine({disabled: true, onPressWord: jest.fn()});

    expect(
      tree.root.findAll(
        node =>
          typeof node.props?.testID === 'string' &&
          node.props.testID.includes('-word-'),
      ),
    ).toHaveLength(0);
  });

  it('offers per-sentence practice only when onPracticeSentence is set (SETE-325, C-3)', () => {
    const onPracticeSentence = jest.fn();
    const {tree} = renderLine({onPracticeSentence});

    act(() => {
      tree.root
        .findByProps({testID: 'transcript-line-seg-0-practice'})
        .props.onPress();
    });

    expect(onPracticeSentence).toHaveBeenCalledWith(makeSegment());
  });

  it('uses onPrimaryContainer for active IPA text contrast', () => {
    const {tree} = renderLine({isActive: true});
    const ipaNode = tree.root.findByProps({
      testID: 'transcript-line-seg-0-ipa',
    });
    const flatStyle = Array.isArray(ipaNode.props.style)
      ? Object.assign({}, ...ipaNode.props.style.filter(Boolean))
      : ipaNode.props.style;

    expect(flatStyle.color).toBeDefined();
    expect(ipaNode.props.color).toBeUndefined();
  });
});
