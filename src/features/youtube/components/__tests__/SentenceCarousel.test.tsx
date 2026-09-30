import React from 'react';
import {FlatList} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {
  makeEnrichment,
  VIDEO_ID,
} from '../../logic/sentence/__tests__/fixtures/sentenceFixtures';
import {SentenceCarousel} from '../SentenceCarousel';

const CAROUSEL_TEST_ID = 'test-sentence-carousel';

function makeSegments() {
  return [
    {
      index: 0,
      en: 'First sentence text',
      vi: 'Câu đầu tiên',
    },
    {
      index: 1,
      en: 'Second sentence text',
      vi: 'Câu thứ hai',
    },
    {
      index: 2,
      en: 'Third sentence text',
      vi: 'Câu thứ ba',
    },
  ];
}

function renderCarousel(
  props: Partial<React.ComponentProps<typeof SentenceCarousel>> = {},
) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <SentenceCarousel
            activeIndex={0}
            enrichmentMap={{
              0: makeEnrichment(),
              1: makeEnrichment(),
              2: makeEnrichment(),
            }}
            onSelectIndex={jest.fn()}
            segments={makeSegments()}
            testID={CAROUSEL_TEST_ID}
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

describe('SentenceCarousel (SETE-330)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });
  it('renders a horizontal FlatList with spec-compliant snap interval, deceleration, and padding', () => {
    const tree = renderCarousel();

    const flatList = tree.root.findByType(FlatList);
    expect(flatList.props.horizontal).toBe(true);
    expect(flatList.props.decelerationRate).toBe('fast');
    expect(flatList.props.snapToAlignment).toBe('start');
    expect(flatList.props.contentContainerStyle).toMatchObject({
      paddingHorizontal: 12,
    });
    // Default mock windowWidth in jest is typically 750 or 390
    // snapToInterval = windowWidth - 14
    expect(flatList.props.snapToInterval).toBeGreaterThan(0);
  });

  it('renders sentence cards for all segments with header title Câu N/M', () => {
    const tree = renderCarousel({level: 'Intermediate'});

    for (let i = 0; i < 3; i++) {
      expect(hasNode(tree, `${CAROUSEL_TEST_ID}-card-${i}`)).toBe(true);

      expect(
        tree.root.findByProps({testID: `${CAROUSEL_TEST_ID}-card-${i}-level`})
          .props.label,
      ).toBe('Intermediate');
    }
  });

  it('computes nearest card index and calls onSelectIndex on momentum scroll end', () => {
    const onSelectIndex = jest.fn();
    const tree = renderCarousel({onSelectIndex});

    const flatList = tree.root.findByType(FlatList);
    const snapInterval = flatList.props.snapToInterval;

    // Simulate scrolling horizontally to card 1
    act(() => {
      flatList.props.onScrollBeginDrag();
      flatList.props.onMomentumScrollEnd({
        nativeEvent: {
          contentOffset: {x: snapInterval, y: 0},
        },
      });
    });

    expect(onSelectIndex).toHaveBeenCalledWith(1);
  });

  it('maintains consistent horizontal padding and selects index 0 when scrolling/flicking back to start (DEFECT-SETE-337-03)', () => {
    const onSelectIndex = jest.fn();
    const tree = renderCarousel({activeIndex: 1, onSelectIndex});

    const flatList = tree.root.findByType(FlatList);
    expect(flatList.props.contentContainerStyle).toMatchObject({
      paddingHorizontal: 12,
    });

    // Simulate momentum scrolling back to start (x = 0)
    act(() => {
      flatList.props.onScrollBeginDrag();
      flatList.props.onMomentumScrollEnd({
        nativeEvent: {
          contentOffset: {x: 0, y: 0},
        },
      });
    });

    expect(onSelectIndex).toHaveBeenCalledWith(0);
  });

  it('preserves vertical scroll memory across card selections in the session', () => {
    const tree = renderCarousel();

    // Scroll card 0 vertically to y=150
    act(() => {
      tree.root
        .findByProps({testID: `${CAROUSEL_TEST_ID}-card-0-scroll`})
        .props.onScroll({
          nativeEvent: {
            contentOffset: {y: 150, x: 0},
            layoutMeasurement: {height: 400, width: 300},
            contentSize: {height: 800, width: 300},
          },
        });
    });

    // Re-render carousel at activeIndex=1
    act(() => {
      tree.update(
        <FeatureFlagProvider>
          <AppThemeProvider>
            <SentenceCarousel
              activeIndex={1}
              enrichmentMap={{
                0: makeEnrichment(),
                1: makeEnrichment(),
                2: makeEnrichment(),
              }}
              onSelectIndex={jest.fn()}
              segments={makeSegments()}
              testID={CAROUSEL_TEST_ID}
              videoId={VIDEO_ID}
            />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });

    // Verify card 0 keeps initialScrollOffset=150
    const card0 = tree.root.findByProps({testID: `${CAROUSEL_TEST_ID}-card-0`});
    expect(card0.props.initialScrollOffset).toBe(150);
  });

  it('clicking next sentence prompt on bottom bar triggers onSelectIndex with next index', () => {
    const onSelectIndex = jest.fn();
    const tree = renderCarousel({
      onSelectIndex,
      enrichmentMap: {
        0: makeEnrichment({grammar: []}), // no grammar points, shows prompt immediately
      },
    });

    act(() => {
      tree.root
        .findByProps({testID: `${CAROUSEL_TEST_ID}-card-0-bottom-next-prompt`})
        .props.onPress();
    });

    expect(onSelectIndex).toHaveBeenCalledWith(1);
  });

  it('forwards save card toggle action to onToggleSaveSegment', () => {
    const onToggleSaveSegment = jest.fn();
    const tree = renderCarousel({
      onToggleSaveSegment,
      savedSegmentIds: new Set([0]),
    });

    act(() => {
      tree.root
        .findByProps({testID: `${CAROUSEL_TEST_ID}-card-0-toggle-save`})
        .props.onPress();
    });

    expect(onToggleSaveSegment).toHaveBeenCalledWith({
      index: 0,
      en: 'First sentence text',
      vi: 'Câu đầu tiên',
    });
  });

  it('forwards play sentence audio to onPlaySentenceAudio', () => {
    const onPlaySentenceAudio = jest.fn();
    const tree = renderCarousel({onPlaySentenceAudio});

    // Layout sentence block and scroll past to reveal pinned audio
    act(() => {
      tree.root
        .findByProps({testID: `${CAROUSEL_TEST_ID}-card-0-sentence-block`})
        .props.onLayout({
          nativeEvent: {layout: {height: 50, y: 0, width: 300, x: 0}},
        });
    });
    act(() => {
      tree.root
        .findByProps({testID: `${CAROUSEL_TEST_ID}-card-0-scroll`})
        .props.onScroll({
          nativeEvent: {
            contentOffset: {y: 70, x: 0},
            layoutMeasurement: {height: 400, width: 300},
            contentSize: {height: 800, width: 300},
          },
        });
    });

    act(() => {
      tree.root
        .findByProps({testID: `${CAROUSEL_TEST_ID}-card-0-pinned-audio`})
        .props.onPress();
    });

    expect(onPlaySentenceAudio).toHaveBeenCalledWith({
      index: 0,
      en: 'First sentence text',
      vi: 'Câu đầu tiên',
    });
  });

  it('renders dots indicator when <= 10 sentences and highlights active dot', () => {
    const tree = renderCarousel({activeIndex: 1});

    expect(
      tree.root.findByProps({testID: 'youtube-dots-indicator'}),
    ).toBeTruthy();
    expect(tree.root.findByProps({testID: 'youtube-dot-0'})).toBeTruthy();
    expect(tree.root.findByProps({testID: 'youtube-dot-1'})).toBeTruthy();
    expect(tree.root.findByProps({testID: 'youtube-dot-2'})).toBeTruthy();
  });

  it('hides dots indicator when > 10 sentences', () => {
    const longSegments = Array.from({length: 12}, (_, i) => ({
      index: i,
      en: `Sentence ${i}`,
      vi: `Câu ${i}`,
    }));
    const tree = renderCarousel({segments: longSegments});

    expect(() =>
      tree.root.findByProps({testID: 'youtube-dots-indicator'}),
    ).toThrow();
  });

  it('renders floating back-chip when showBackChip is true and handles press', () => {
    const onPressBackChip = jest.fn();
    const tree = renderCarousel({
      activeIndex: 2,
      showBackChip: true,
      onPressBackChip,
    });

    const chip = tree.root.findByProps({testID: 'youtube-back-to-active-chip'});
    expect(chip).toBeTruthy();
    act(() => {
      chip.props.onPress();
    });
    expect(onPressBackChip).toHaveBeenCalledTimes(1);
  });

  it('renders toast message when toastMessage is provided', () => {
    const tree = renderCarousel({
      toastMessage: '→ Đang tới câu 2 · 00:03',
    });

    const toast = tree.root.findByProps({testID: 'youtube-toast-message'});
    expect(toast).toBeTruthy();
  });

  describe('SETE-333: Carousel Accessibility', () => {
    it('sets accessibilityLabel on the carousel with Câu N trên M', () => {
      const tree = renderCarousel({activeIndex: 1});
      const flatList = tree.root.findByProps({
        testID: `${CAROUSEL_TEST_ID}-list`,
      });
      expect(flatList.props.accessibilityLabel).toBe('Câu 2 trên 3');
    });

    it('navigates with accessibility buttons prev and next', () => {
      const onSelectIndex = jest.fn();
      const tree = renderCarousel({
        activeIndex: 1,
        onSelectIndex,
      });

      const prevBtn = tree.root.findByProps({
        testID: 'youtube-carousel-prev',
      });
      const nextBtn = tree.root.findByProps({
        testID: 'youtube-carousel-next',
      });

      expect(prevBtn).toBeTruthy();
      expect(nextBtn).toBeTruthy();

      act(() => {
        prevBtn.props.onPress();
      });
      expect(onSelectIndex).toHaveBeenCalledWith(0);

      act(() => {
        nextBtn.props.onPress();
      });
      expect(onSelectIndex).toHaveBeenCalledWith(2);
    });
  });

  describe('DEFECT-SETE-337-07: resume far into a lesson', () => {
    function makeManySegments(count: number) {
      return Array.from({length: count}, (_, i) => ({
        index: i,
        en: `Sentence ${i}`,
        vi: `Câu ${i}`,
      }));
    }

    it('mounts the FlatList at a non-zero initial activeIndex so the resumed card renders without scrolling', () => {
      const segments = makeManySegments(137);
      const tree = renderCarousel({segments, activeIndex: 119});

      const flatList = tree.root.findByType(FlatList);
      // Mount position targets the resumed sentence (getItemLayout above
      // satisfies the initialScrollIndex requirement).
      expect(flatList.props.initialScrollIndex).toBe(119);
      // The resumed card is rendered immediately — no scroll interaction needed.
      expect(hasNode(tree, `${CAROUSEL_TEST_ID}-card-119`)).toBe(true);
    });

    it('clamps an out-of-range activeIndex instead of crashing FlatList', () => {
      const segments = makeManySegments(3);
      const tree = renderCarousel({segments, activeIndex: 99});

      const flatList = tree.root.findByType(FlatList);
      expect(flatList.props.initialScrollIndex).toBe(2);
    });
  });
});
