import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {AppText} from '@ui/components/AppText';
import {FeatureFlagProvider} from '@/release';
import {AppThemeProvider} from '@ui/theme/index';
import {SentenceCard} from '../SentenceCard';
import type {RetryBlockFn} from '../useSentenceEnrichment';
import {
  makeEnrichment,
  makeFailedSegment,
  makePartialSegment,
  makeSegment,
  VIDEO_ID,
} from './fixtures/sentenceFixtures';

const CARD_TEST_ID = 'sentence-card-0';

function renderCard(
  props: Partial<React.ComponentProps<typeof SentenceCard>> = {},
) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <SentenceCard
            enrichment={makeSegment().enrichment}
            segment={makeSegment()}
            testID={CARD_TEST_ID}
            videoId={VIDEO_ID}
            {...props}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

function hasNode(tree: renderer.ReactTestRenderer, testID: string): boolean {
  try {
    tree.root.findByProps({testID});
    return true;
  } catch {
    return false;
  }
}

/** Flattens nested AppText/fragment children into plain text. */
function flattenText(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(flattenText).join('');
  }
  if (
    typeof node === 'object' &&
    node !== null &&
    'props' in node &&
    typeof (node as {props?: unknown}).props === 'object'
  ) {
    const props = (node as {props: {children?: unknown}}).props;
    return flattenText(props.children);
  }
  return '';
}

describe('SentenceCard', () => {
  it('renders the sentence from segment.en only, with its translation', () => {
    const tree = renderCard();

    expect(
      tree.root.findByProps({testID: `${CARD_TEST_ID}-en`}).props.children,
    ).toBe('We are learning through video');
    // VI text may wrap the dynamic highlight span — compare flattened text.
    expect(
      flattenText(
        tree.root.findByProps({testID: `${CARD_TEST_ID}-vi`}).props.children,
      ),
    ).toBe('Chúng ta đang học qua video');
  });

  it('shows a 3-block skeleton while enrichment is absent', () => {
    const tree = renderCard({enrichment: null});

    for (const block of ['keyword', 'vocab', 'grammar'] as const) {
      expect(hasNode(tree, `${CARD_TEST_ID}-block-${block}-skeleton`)).toBe(
        true,
      );
    }
    expect(hasNode(tree, `${CARD_TEST_ID}-block-vocab-value`)).toBe(false);
  });

  it('fills all three blocks when enrichment is ready', () => {
    const tree = renderCard();

    const keywordNode = tree.root.findByProps({
      testID: `${CARD_TEST_ID}-block-keyword-value`,
    });
    const keywordTexts = keywordNode
      .findAllByType(AppText)
      .map(node => node.props.children);
    expect(keywordTexts).toContain('learning');
    expect(hasNode(tree, `${CARD_TEST_ID}-block-vocab-value`)).toBe(true);
    expect(hasNode(tree, `${CARD_TEST_ID}-block-grammar-value`)).toBe(true);
    expect(hasNode(tree, `${CARD_TEST_ID}-block-vocab-skeleton`)).toBe(false);
  });

  it('falls back to the longest content word when the AI keyword is null', () => {
    const tree = renderCard({
      enrichment: makeEnrichment({keyWord: null, status: 'partial'}),
    });

    const keywordNode = tree.root.findByProps({
      testID: `${CARD_TEST_ID}-block-keyword-value`,
    });
    const keywordTexts = keywordNode
      .findAllByType(AppText)
      .map(node => node.props.children);
    expect(keywordTexts).toContain('learning');
  });

  it('renders a short card for partial enrichment: no placeholder, no error', () => {
    const segment = makePartialSegment();
    const tree = renderCard({enrichment: segment.enrichment, segment});

    // Keyword still renders via fallback.
    const keywordNode = tree.root.findByProps({
      testID: `${CARD_TEST_ID}-block-keyword-value`,
    });
    const keywordTexts = keywordNode
      .findAllByType(AppText)
      .map(node => node.props.children);
    expect(keywordTexts).toContain('learning');
    // Missing vocab/grammar leave no node behind at all.
    for (const block of ['vocab', 'grammar'] as const) {
      expect(hasNode(tree, `${CARD_TEST_ID}-block-${block}-value`)).toBe(false);
      expect(hasNode(tree, `${CARD_TEST_ID}-block-${block}-skeleton`)).toBe(
        false,
      );
      expect(hasNode(tree, `${CARD_TEST_ID}-block-${block}-error`)).toBe(false);
    }
  });

  it('shows a per-block error with retry when the sentence failed', () => {
    const segment = makeFailedSegment();
    const tree = renderCard({
      enrichment: segment.enrichment,
      segment,
      retryBlock: jest.fn(),
    });

    expect(hasNode(tree, `${CARD_TEST_ID}-block-vocab-error`)).toBe(true);
    expect(hasNode(tree, `${CARD_TEST_ID}-block-grammar-error`)).toBe(true);
    // The keyword block still renders via fallback; the card is not an error.
    expect(
      tree.root.findByProps({testID: `${CARD_TEST_ID}-en`}).props.children,
    ).toBe('We are learning through video');
  });

  it('retries one block and fills only that block on success', async () => {
    const segment = makeFailedSegment();
    const retryBlock: RetryBlockFn = jest.fn().mockResolvedValue({
      ok: true,
      enrichment: makeEnrichment({status: 'partial'}),
    });
    const tree = renderCard({
      enrichment: segment.enrichment,
      segment,
      retryBlock,
    });

    await act(async () => {
      tree.root
        .findByProps({testID: `${CARD_TEST_ID}-block-vocab-error-retry`})
        .props.onPress();
    });

    expect(retryBlock).toHaveBeenCalledWith({
      videoId: VIDEO_ID,
      segmentIndex: 0,
      block: 'vocab',
    });
    expect(hasNode(tree, `${CARD_TEST_ID}-block-vocab-value`)).toBe(true);
    expect(hasNode(tree, `${CARD_TEST_ID}-block-vocab-error`)).toBe(false);
  });

  it('keeps the block error when its retry fails', async () => {
    const segment = makeFailedSegment();
    const retryBlock: RetryBlockFn = jest.fn().mockResolvedValue({
      ok: false,
      message: 'ENRICHMENT_AI_QUOTA_EXCEEDED',
    });
    const tree = renderCard({
      enrichment: segment.enrichment,
      segment,
      retryBlock,
    });

    await act(async () => {
      tree.root
        .findByProps({testID: `${CARD_TEST_ID}-block-grammar-error-retry`})
        .props.onPress();
    });

    expect(hasNode(tree, `${CARD_TEST_ID}-block-grammar-error`)).toBe(true);
    expect(hasNode(tree, `${CARD_TEST_ID}-block-grammar-value`)).toBe(false);
  });

  describe('SETE-330 (TASK-3 additions)', () => {
    // The fixed header title 'Câu N/M' was removed to avoid duplication with CompactControlBar

    it('renders level badge when level is provided and non-empty (D-1)', () => {
      const tree = renderCard({level: 'B1'});
      expect(hasNode(tree, `${CARD_TEST_ID}-level`)).toBe(true);
      expect(
        tree.root.findByProps({testID: `${CARD_TEST_ID}-level`}).props.label,
      ).toBe('B1');
    });

    it('omits level badge completely when level is null, undefined, or empty (D-1)', () => {
      const treeNull = renderCard({level: null});
      expect(hasNode(treeNull, `${CARD_TEST_ID}-level`)).toBe(false);

      const treeEmpty = renderCard({level: ''});
      expect(hasNode(treeEmpty, `${CARD_TEST_ID}-level`)).toBe(false);
    });

    it('calls onToggleSave when bookmark button is pressed', () => {
      const onToggleSave = jest.fn();
      const tree = renderCard({onToggleSave, isSaved: false});

      act(() => {
        tree.root
          .findByProps({testID: `${CARD_TEST_ID}-toggle-save`})
          .props.onPress();
      });

      expect(onToggleSave).toHaveBeenCalledTimes(1);
    });

    it('renders the fixed emerald listen bar with audio button and instruction text immediately without scrolling', () => {
      const onPlaySentenceAudio = jest.fn();
      const tree = renderCard({onPlaySentenceAudio});

      expect(hasNode(tree, `${CARD_TEST_ID}-listen-bar`)).toBe(true);
      expect(
        tree.root.findByProps({testID: `${CARD_TEST_ID}-listen-hint`}).props
          .children,
      ).toBe('Chạm từng từ để tra nghĩa & nghe phát âm lẻ');

      act(() => {
        tree.root
          .findByProps({testID: `${CARD_TEST_ID}-listen-audio`})
          .props.onPress();
      });
      expect(onPlaySentenceAudio).toHaveBeenCalledWith(
        expect.objectContaining({en: 'We are learning through video'}),
      );
    });

    it('shows pinned sentence bar when scrolled past sentence block', () => {
      const onPlaySentenceAudio = jest.fn();
      const tree = renderCard({onPlaySentenceAudio});

      // Initially not pinned
      expect(hasNode(tree, `${CARD_TEST_ID}-pinned-sentence`)).toBe(false);

      // Measure sentence block height
      act(() => {
        tree.root
          .findByProps({testID: `${CARD_TEST_ID}-sentence-block`})
          .props.onLayout({
            nativeEvent: {layout: {height: 60, y: 0, width: 300, x: 0}},
          });
      });

      // Scroll past height
      act(() => {
        tree.root
          .findByProps({testID: `${CARD_TEST_ID}-scroll`})
          .props.onScroll({
            nativeEvent: {
              contentOffset: {y: 80, x: 0},
              layoutMeasurement: {height: 400, width: 300},
              contentSize: {height: 800, width: 300},
            },
          });
      });

      expect(hasNode(tree, `${CARD_TEST_ID}-pinned-sentence`)).toBe(true);
      expect(
        tree.root.findByProps({testID: `${CARD_TEST_ID}-pinned-sentence-text`})
          .props.children,
      ).toBe('We are learning through video');

      // Tapping audio button triggers audio playback
      act(() => {
        tree.root
          .findByProps({testID: `${CARD_TEST_ID}-pinned-audio`})
          .props.onPress();
      });
      expect(onPlaySentenceAudio).toHaveBeenCalled();
    });

    it('reports scroll offset to onScrollOffsetChange for session memory', () => {
      const onScrollOffsetChange = jest.fn();
      const tree = renderCard({onScrollOffsetChange});

      act(() => {
        tree.root
          .findByProps({testID: `${CARD_TEST_ID}-scroll`})
          .props.onScroll({
            nativeEvent: {
              contentOffset: {y: 120, x: 0},
              layoutMeasurement: {height: 400, width: 300},
              contentSize: {height: 800, width: 300},
            },
          });
      });

      expect(onScrollOffsetChange).toHaveBeenCalledWith(0, 120);
    });

    it('shows bottom grammar hint when content is scrollable and next sentence prompt at bottom', () => {
      const onNextSentence = jest.fn();
      const tree = renderCard({
        totalSegments: 5,
        onNextSentence,
      });

      // Grammar points exist, not at bottom yet
      expect(hasNode(tree, `${CARD_TEST_ID}-bottom-grammar-hint`)).toBe(true);

      // Scroll to bottom
      act(() => {
        tree.root
          .findByProps({testID: `${CARD_TEST_ID}-scroll`})
          .props.onScroll({
            nativeEvent: {
              contentOffset: {y: 450, x: 0},
              layoutMeasurement: {height: 400, width: 300},
              contentSize: {height: 800, width: 300},
            },
          });
      });

      expect(hasNode(tree, `${CARD_TEST_ID}-bottom-next-prompt`)).toBe(true);
      expect(
        tree.root
          .findByProps({testID: `${CARD_TEST_ID}-bottom-next-prompt`})
          .findAllByType(AppText)[0].props.children,
      ).toBe('Vuốt ngang để sang câu 2 →');

      act(() => {
        tree.root
          .findByProps({testID: `${CARD_TEST_ID}-bottom-next-prompt`})
          .props.onPress();
      });
      expect(onNextSentence).toHaveBeenCalled();
    });

    it('shows lesson completed prompt for the last sentence', () => {
      const segment = makeSegment();
      segment.index = 4; // index 4 of 5
      const tree = renderCard({
        segment,
        totalSegments: 5,
      });

      expect(hasNode(tree, `${CARD_TEST_ID}-bottom-completed`)).toBe(true);
    });
  });

  describe('SETE-333: Accessibility & Selectability', () => {
    it('marks primary text elements as selectable for user copying', () => {
      const tree = renderCard({onPressWord: undefined});
      const enText = tree.root.findByProps({testID: `${CARD_TEST_ID}-en`});
      const viText = tree.root.findByProps({testID: `${CARD_TEST_ID}-vi`});

      expect(enText.props.selectable).toBe(true);
      expect(viText.props.selectable).toBe(true);
    });

    it('sets accessibilityRole header on the card header container', () => {
      const tree = renderCard();
      const header = tree.root.findByProps({testID: `${CARD_TEST_ID}-header`});
      expect(header.props.accessibilityRole).toBe('header');
    });
  });
});
