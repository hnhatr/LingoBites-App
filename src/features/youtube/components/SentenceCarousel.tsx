import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {useAppTheme, type AppTheme} from '@ui/theme/index';
import type {SentenceEnrichment} from '@core/schemas/sentence-contract';
import type {GrammarPoint, VocabEntry} from '@core/schemas/sentence-contract';
import {SentenceCard, type SentenceCardSegment} from './SentenceCard';
import type {RetryBlockFn} from '../logic/sentence/useSentenceEnrichment';
import {
  CARD_SPACING_PT,
  CAROUSEL_HORIZONTAL_PADDING_PT,
  calculateNearestCardIndex,
  getCardSnapInterval,
  getCardWidth,
} from '../logic/sentence/sentenceCardGeometry';
import {shouldShowDots} from '../logic/utils/toolsLogic';

export type SentenceCarouselRef = {
  scrollToIndex: (params: {
    index: number;
    animated?: boolean;
    viewPosition?: number;
  }) => void;
  scrollToOffset: (params: {offset: number; animated?: boolean}) => void;
};

export type SentenceCarouselProps = {
  videoId: string;
  segments: readonly SentenceCardSegment[];
  /** Map of segment index to its known enrichment. */
  enrichmentMap?: Record<number, SentenceEnrichment | null>;
  /** Currently active sentence index (0-based). */
  activeIndex: number;
  /** Callback when user swipes/selects a different sentence card. */
  onSelectIndex: (index: number) => void;
  /** Proficiency level label (e.g. B1, Intermediate), null/omitted = hidden. */
  level?: string | null;
  /** Injectable per-block retry fetcher for tests. */
  retryBlock?: RetryBlockFn;
  /** Controlled translation visibility (true = show VI, false = hide VI). */
  showTranslation?: boolean;
  /** Set of saved segment IDs / indices. */
  savedSegmentIds?: Set<string | number>;
  onToggleSaveSegment?: (segment: SentenceCardSegment) => void;
  onPlaySentenceAudio?: (segment: SentenceCardSegment) => void;
  onPressWord?: (word: string) => void;
  onPracticeSentence?: (segment: SentenceCardSegment) => void;
  /** Saved word keys (lowercased) shared across cards for ★ sync. */
  savedWordIds?: Set<string>;
  onToggleWordSave?: (word: string, entry?: VocabEntry) => void;
  /** Saved grammar keys (point name). */
  savedGrammarIds?: Set<string>;
  onToggleGrammarSave?: (point: GrammarPoint) => void;
  /** Optional override for dots indicator (defaults to <=10 segments). */
  showDots?: boolean;
  /** Whether to show the back-to-active floating chip */
  showBackChip?: boolean;
  onPressBackChip?: () => void;
  /** Transient toast message to display */
  toastMessage?: string | null;
  /** Optional callback when a card's vertical scroll offset changes */
  onCardScrollOffsetChange?: (segmentIndex: number, offset: number) => void;
  testID?: string;
};

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    listContent: {
      paddingBottom: theme.spacing.md,
      paddingHorizontal: CAROUSEL_HORIZONTAL_PADDING_PT,
      paddingTop: theme.spacing.xs,
    },
    cardWrap: {
      marginRight: CARD_SPACING_PT,
    },
    dotsContainer: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
      paddingVertical: theme.spacing.xs,
    },
    dot: {
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: 3,
      height: 6,
      width: 6,
    },
    dotActive: {
      backgroundColor: theme.colors.accent,
      borderRadius: 4,
      height: 8,
      width: 8,
    },
    backChip: {
      alignSelf: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.accent,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      bottom: theme.spacing.md,
      elevation: 4,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      position: 'absolute',
      shadowColor: theme.colors.text.primary,
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.15,
      shadowRadius: 4,
      zIndex: 10,
    },
    a11yControls: {
      alignSelf: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      bottom: theme.spacing.md,
      elevation: 6,
      flexDirection: 'row',
      position: 'absolute',
      shadowColor: theme.colors.text.primary,
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.15,
      shadowRadius: 4,
      zIndex: 20,
    },
    a11yBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: theme.spacing.md,
    },
    a11yBtnDivider: {
      backgroundColor: theme.colors.surfaceHigh,
      width: 1,
    },
    a11yBtnDisabled: {
      opacity: 0.3,
    },
    toast: {
      alignSelf: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      elevation: 6,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      position: 'absolute',
      shadowColor: theme.colors.text.primary,
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.2,
      shadowRadius: 4,
      top: theme.spacing.xs,
      zIndex: 20,
    },
  });
}

/**
 * SETE-330 / SETE-332 (TASK-3 & TASK-5): Horizontal carousel for sentence cards
 * with dots indicator (<=10), back-to-active chip, and toast synchronization.
 */
export const SentenceCarousel = React.forwardRef<
  SentenceCarouselRef,
  SentenceCarouselProps
>(function SentenceCarouselInner(
  {
    videoId,
    segments,
    enrichmentMap = {},
    activeIndex,
    onSelectIndex,
    level,
    retryBlock,
    showTranslation,
    savedSegmentIds,
    onToggleSaveSegment,
    onPlaySentenceAudio,
    onPressWord,
    onPracticeSentence,
    savedWordIds,
    onToggleWordSave,
    savedGrammarIds,
    onToggleGrammarSave,
    showDots,
    showBackChip = false,
    onPressBackChip,
    toastMessage,
    onCardScrollOffsetChange,
    testID,
  },
  ref,
) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const windowWidth = useWindowDimensions().width;

  const cardWidth = getCardWidth(windowWidth);
  const snapInterval = getCardSnapInterval(windowWidth);

  const flatListRef = useRef<FlatList<SentenceCardSegment>>(null);
  const scrollMemoryRef = useRef<Map<number, number>>(new Map());
  const isUserScrollingRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);

  useImperativeHandle(
    ref,
    () => ({
      scrollToIndex: ({index, animated = true}) => {
        const targetOffset = index * snapInterval;
        isProgrammaticScrollRef.current = true;
        flatListRef.current?.scrollToOffset({
          animated,
          offset: targetOffset,
        });
      },
      scrollToOffset: ({offset, animated = true}) => {
        isProgrammaticScrollRef.current = true;
        flatListRef.current?.scrollToOffset({
          animated,
          offset,
        });
      },
    }),
    [snapInterval],
  );

  // Sync horizontal carousel position when activeIndex changes externally
  useEffect(() => {
    if (isUserScrollingRef.current || segments.length === 0) {
      return;
    }
    const targetOffset = activeIndex * snapInterval;
    isProgrammaticScrollRef.current = true;
    flatListRef.current?.scrollToOffset({
      animated: true,
      offset: targetOffset,
    });
  }, [activeIndex, segments.length, snapInterval]);

  const handleScrollOffsetChange = useCallback(
    (segmentIndex: number, offset: number) => {
      scrollMemoryRef.current.set(segmentIndex, offset);
      onCardScrollOffsetChange?.(segmentIndex, offset);
    },
    [onCardScrollOffsetChange],
  );

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      isUserScrollingRef.current = false;
      if (isProgrammaticScrollRef.current) {
        isProgrammaticScrollRef.current = false;
        return;
      }
      const scrollX = event.nativeEvent.contentOffset.x;
      const nextIndex = calculateNearestCardIndex(
        scrollX,
        windowWidth,
        segments.length,
      );
      if (nextIndex !== activeIndex) {
        onSelectIndex(nextIndex);
      }
    },
    [activeIndex, onSelectIndex, segments.length, windowWidth],
  );

  const handleScrollBeginDrag = useCallback(() => {
    isUserScrollingRef.current = true;
    isProgrammaticScrollRef.current = false;
  }, []);

  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const scrollX = event.nativeEvent.contentOffset.x;
      const nextIndex = calculateNearestCardIndex(
        scrollX,
        windowWidth,
        segments.length,
      );
      if (nextIndex !== activeIndex) {
        onSelectIndex(nextIndex);
      }
      isUserScrollingRef.current = false;
    },
    [activeIndex, onSelectIndex, segments.length, windowWidth],
  );

  const handleNextSentence = useCallback(
    (currentIndex: number) => {
      if (currentIndex < segments.length - 1) {
        onSelectIndex(currentIndex + 1);
      }
    },
    [onSelectIndex, segments.length],
  );

  const renderItem = useCallback(
    ({item}: ListRenderItemInfo<SentenceCardSegment>) => {
      const enrichment = enrichmentMap[item.index] ?? null;
      const initialScrollOffset = scrollMemoryRef.current.get(item.index) ?? 0;
      const isSaved = savedSegmentIds?.has(item.index) ?? false;

      return (
        <View style={styles.cardWrap}>
          <SentenceCard
            enrichment={enrichment}
            initialScrollOffset={initialScrollOffset}
            isSaved={isSaved}
            level={level}
            onNextSentence={() => handleNextSentence(item.index)}
            onPlaySentenceAudio={onPlaySentenceAudio}
            onPracticeSentence={onPracticeSentence}
            onPressWord={onPressWord}
            onScrollOffsetChange={handleScrollOffsetChange}
            onToggleSave={() => onToggleSaveSegment?.(item)}
            onToggleWordSave={onToggleWordSave}
            onToggleGrammarSave={onToggleGrammarSave}
            retryBlock={retryBlock}
            savedGrammarIds={savedGrammarIds}
            savedWordIds={savedWordIds}
            segment={item}
            showTranslation={showTranslation}
            testID={
              testID
                ? `${testID}-card-${item.index}`
                : `sentence-card-${item.index}`
            }
            totalSegments={segments.length}
            videoId={videoId}
            width={cardWidth}
          />
        </View>
      );
    },
    [
      cardWidth,
      enrichmentMap,
      handleNextSentence,
      handleScrollOffsetChange,
      level,
      onPlaySentenceAudio,
      onPracticeSentence,
      onPressWord,
      onToggleSaveSegment,
      onToggleWordSave,
      onToggleGrammarSave,
      retryBlock,
      savedGrammarIds,
      savedSegmentIds,
      savedWordIds,
      segments.length,
      showTranslation,
      styles.cardWrap,
      testID,
      videoId,
    ],
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: snapInterval,
      offset: snapInterval * index,
      index,
    }),
    [snapInterval],
  );

  const isDotsVisible =
    showDots !== undefined ? showDots : shouldShowDots(segments.length);

  // DEFECT-SETE-337-07: mount the FlatList at the resumed activeIndex so a
  // far-into-the-lesson resume renders the correct card immediately. Without
  // initialScrollIndex the list mounts at 0 and relies on the scrollToOffset
  // sync effect, which leaves a blank window when virtualization hasn't
  // loaded the far window yet. getItemLayout (above) satisfies the
  // initialScrollIndex requirement. Clamped so an out-of-range activeIndex
  // can never crash FlatList; undefined when empty (FlatList default = 0).
  // Mount-only: subsequent activeIndex changes are still synced by the
  // scrollToOffset effect above.
  const initialScrollIndex = useMemo(() => {
    if (segments.length === 0) {
      return undefined;
    }
    return Math.min(Math.max(activeIndex, 0), segments.length - 1);
  }, [activeIndex, segments.length]);

  const handlePrev = useCallback(() => {
    if (activeIndex > 0) {
      onSelectIndex(activeIndex - 1);
    }
  }, [activeIndex, onSelectIndex]);

  const handleNext = useCallback(() => {
    if (activeIndex < segments.length - 1) {
      onSelectIndex(activeIndex + 1);
    }
  }, [activeIndex, onSelectIndex, segments.length]);

  return (
    <View
      accessibilityActions={[
        {name: 'increment', label: 'Câu sau'},
        {name: 'decrement', label: 'Câu trước'},
      ]}
      accessibilityHint="Cuộn sang câu khác bằng cử chỉ hoặc nút điều khiển"
      accessibilityLabel={`Câu ${activeIndex + 1} trên ${segments.length}`}
      accessibilityRole="adjustable"
      accessibilityValue={{
        text: `Câu ${activeIndex + 1} trên ${segments.length}`,
      }}
      onAccessibilityAction={e => {
        if (e.nativeEvent.actionName === 'increment') {
          handleNext();
        } else if (e.nativeEvent.actionName === 'decrement') {
          handlePrev();
        }
      }}
      style={styles.container}
      testID={testID}
    >
      {toastMessage ? (
        <View style={styles.toast} testID="youtube-toast-message">
          <AppText variant="label">{toastMessage}</AppText>
        </View>
      ) : null}

      {/* a11yControls is now a sticky footer at the bottom of the carousel */}
      <View style={styles.a11yControls} testID="youtube-carousel-a11y-controls">
        <Pressable
          accessibilityHint="Chuyển sang câu trước đó"
          accessibilityLabel="Câu trước"
          accessibilityRole="button"
          accessibilityState={{disabled: activeIndex <= 0}}
          disabled={activeIndex <= 0}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
          onPress={handlePrev}
          style={[styles.a11yBtn, activeIndex <= 0 && styles.a11yBtnDisabled]}
          testID="youtube-carousel-prev"
        >
          <MaterialIcon
            color={
              activeIndex <= 0
                ? theme.colors.text.muted
                : theme.colors.text.primary
            }
            name="chevron_left"
            size={24}
          />
        </Pressable>
        <View style={styles.a11yBtnDivider} />
        <Pressable
          accessibilityHint="Chuyển sang câu tiếp theo"
          accessibilityLabel="Câu sau"
          accessibilityRole="button"
          accessibilityState={{disabled: activeIndex >= segments.length - 1}}
          disabled={activeIndex >= segments.length - 1}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
          onPress={handleNext}
          style={[
            styles.a11yBtn,
            activeIndex >= segments.length - 1 && styles.a11yBtnDisabled,
          ]}
          testID="youtube-carousel-next"
        >
          <MaterialIcon
            color={
              activeIndex >= segments.length - 1
                ? theme.colors.text.muted
                : theme.colors.text.primary
            }
            name="chevron_right"
            size={24}
          />
        </Pressable>
      </View>

      <FlatList
        accessibilityHint="Danh sách các câu trong bài"
        accessibilityLabel={`Câu ${activeIndex + 1} trên ${segments.length}`}
        contentContainerStyle={styles.listContent}
        data={segments as SentenceCardSegment[]}
        decelerationRate="fast"
        disableIntervalMomentum={true}
        getItemLayout={getItemLayout}
        horizontal={true}
        initialScrollIndex={initialScrollIndex}
        keyExtractor={item => String(item.index)}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        ref={flatListRef}
        renderItem={renderItem}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={snapInterval}
        testID={testID ? `${testID}-list` : 'sentence-carousel-list'}
      />

      {isDotsVisible ? (
        <View style={styles.dotsContainer} testID="youtube-dots-indicator">
          {segments.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex && styles.dotActive]}
              testID={`youtube-dot-${i}`}
            />
          ))}
        </View>
      ) : null}

      {showBackChip ? (
        <Pressable
          accessibilityHint="Chạm để cuộn về câu đang phát"
          accessibilityLabel={`Câu ${activeIndex + 1} đang phát`}
          accessibilityRole="button"
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
          onPress={onPressBackChip}
          style={styles.backChip}
          testID="youtube-back-to-active-chip"
        >
          <AppText variant="label">{`↩ Câu ${
            activeIndex + 1
          } đang phát`}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
});
