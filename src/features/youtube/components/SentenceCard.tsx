import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {IconButton} from '@ui/components/IconButton';
import {useAppTheme, type AppTheme} from '@ui/theme/index';
import type {
  GrammarPoint,
  SentenceEnrichment,
  VocabEntry,
} from '@core/schemas/sentence-contract';
import {
  useSentenceEnrichment,
  type RetryBlockFn,
} from '../logic/sentence/useSentenceEnrichment';
import {
  resolveKeyword,
  type SentenceBlockId,
} from '../logic/sentence/sentencePipeline';
import {
  findViHighlight,
  findVocabEntry,
  formatFunctionWordNote,
  formatGrammarBadge,
  isFunctionWordEntry,
  tokenizeSentenceWords,
} from '../logic/sentence/sentenceWordSelection';
import {
  CARD_BORDER_RADIUS_PT,
  CARD_HEADER_HEIGHT_PT,
  PINNED_AUDIO_BUTTON_SIZE_PT,
  formatGrammarBottomHint,
  formatNextSentencePrompt,
  getCardWidth,
  shouldShowPinnedSentence,
} from '../logic/sentence/sentenceCardGeometry';

export type SentenceCardSegment = {
  index: number;
  en: string;
  vi: string;
};

export type SentenceCardProps = {
  videoId: string;
  /**
   * C-01: the English sentence renders from `segment.en` only. This card
   * never keeps or derives a second copy of the sentence text.
   */
  segment: SentenceCardSegment;
  /** Enrichment known so far; `null` renders the 3-block skeleton. */
  enrichment: SentenceEnrichment | null;
  /** Injectable per-block fetcher for tests; defaults to the retry API. */
  retryBlock?: RetryBlockFn;
  testID?: string;
  /** Total number of sentences (M in `Câu N/M`). */
  totalSegments?: number;
  /** Lesson-level proficiency label (D-1), null/empty = omitted. */
  level?: string | null;
  /** Initial or controlled translation visibility. Defaults to true. */
  showTranslation?: boolean;
  /** Bookmark/save status of this card. */
  isSaved?: boolean;
  onToggleSave?: () => void;
  /** Play audio for the sentence (used by pinned audio button). */
  onPlaySentenceAudio?: (segment: SentenceCardSegment) => void;
  /** Tapping a word token. */
  onPressWord?: (word: string) => void;
  /** Saved word keys (lowercased) for ★ sync between chip + save button. */
  savedWordIds?: Set<string>;
  /** Toggle save for the selected word; parent owns SQLite writes. */
  onToggleWordSave?: (word: string, entry?: VocabEntry) => void;
  /** Saved grammar keys (point name). */
  savedGrammarIds?: Set<string>;
  /** Toggle save for one grammar point; parent owns SQLite writes. */
  onToggleGrammarSave?: (point: GrammarPoint) => void;
  /** Practice action handler. */
  onPracticeSentence?: (segment: SentenceCardSegment) => void;
  /** Next sentence prompt tap handler. */
  onNextSentence?: () => void;
  /** Initial vertical scroll offset to restore from session memory. */
  initialScrollOffset?: number;
  /** Called when vertical scroll position changes to update session memory. */
  onScrollOffsetChange?: (segmentIndex: number, offset: number) => void;
  /** Custom width for the card (defaults to screen width - 27pt). */
  width?: number;
};

/** Runs an async side effect without returning its promise to the caller. */
function fireAndForget(task: Promise<unknown>): void {
  task.catch(() => undefined);
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: CARD_BORDER_RADIUS_PT,
      overflow: 'hidden',
    },
    header: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderBottomColor: theme.colors.surfaceHigh,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      height: CARD_HEADER_HEIGHT_PT,
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.md,
    },
    headerLeft: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    headerRight: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    listenBar: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderBottomColor: theme.colors.outlineVariant,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: theme.spacing.xs,
      minHeight: 40,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 6,
    },
    listenAudioBtn: {
      alignItems: 'center',
      borderRadius: PINNED_AUDIO_BUTTON_SIZE_PT / 2,
      height: PINNED_AUDIO_BUTTON_SIZE_PT,
      justifyContent: 'center',
      minHeight: PINNED_AUDIO_BUTTON_SIZE_PT,
      minWidth: PINNED_AUDIO_BUTTON_SIZE_PT,
      width: PINNED_AUDIO_BUTTON_SIZE_PT,
    },
    waveform: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 2,
      height: 18,
      marginRight: 2,
    },
    waveformBar: {
      backgroundColor: theme.colors.accentInk,
      borderRadius: 1,
      width: 2.5,
    },
    waveformBar1: {
      height: 6,
    },
    waveformBar2: {
      height: 14,
    },
    waveformBar3: {
      height: 10,
    },
    waveformBar4: {
      height: 18,
    },
    waveformBar5: {
      height: 12,
    },
    waveformBar6: {
      height: 8,
    },
    listenHintText: {
      color: theme.colors.accentInk,
      flex: 1,
      fontSize: 12,
      lineHeight: 16,
    },
    pinnedBar: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceHigh,
      borderBottomColor: theme.colors.surfaceMuted,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      height: 44,
      paddingHorizontal: theme.spacing.md,
      position: 'absolute',
      left: 0,
      right: 0,
      top: CARD_HEADER_HEIGHT_PT,
      zIndex: 10,
    },
    pinnedText: {
      flex: 1,
    },
    pinnedAudioBtn: {
      alignItems: 'center',
      borderRadius: PINNED_AUDIO_BUTTON_SIZE_PT / 2,
      height: PINNED_AUDIO_BUTTON_SIZE_PT,
      justifyContent: 'center',
      minHeight: PINNED_AUDIO_BUTTON_SIZE_PT,
      minWidth: PINNED_AUDIO_BUTTON_SIZE_PT,
      width: PINNED_AUDIO_BUTTON_SIZE_PT,
    },
    scrollContent: {
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      paddingBottom: theme.spacing.xl,
    },
    sentenceBlock: {
      gap: theme.spacing.xs,
    },
    // SETE-335 (TASK-8): per-word touch pills. Visual pill stays ~32pt
    // (design `px-2 py-1 text-[14px]`); the ≥44pt touch target comes from
    // `hitSlop` on each Pressable, not from enlarging the pill.
    wordTokens: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    wordPill: {
      backgroundColor: theme.colors.surfaceHigh,
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      minHeight: 32,
      justifyContent: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    wordPillSelected: {
      backgroundColor: theme.colors.tertiaryFixed,
      borderColor: theme.colors.tertiaryBorder,
    },
    wordPillText: {
      fontSize: 14,
      lineHeight: 20,
    },
    wordPillTextSelected: {
      color: theme.colors.onTertiaryContainer,
    },
    translationBox: {
      backgroundColor: theme.colors.surfaceLow,
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      gap: theme.spacing.xs,
      padding: theme.spacing.sm,
    },
    translationRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    hideTranslationBtn: {
      padding: theme.spacing.xs,
    },
    hideTranslationBtnText: {
      color: theme.colors.accent,
    },
    translationText: {
      flex: 1,
    },
    viBadge: {
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.sm,
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    skeleton: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.md,
      height: 44,
    },
    blockError: {
      gap: theme.spacing.xs,
    },
    vocabRow: {
      gap: 2,
    },
    ipaText: {
      fontFamily: 'monospace',
    },
    selectedPod: {
      backgroundColor: theme.colors.tertiarySoft,
      borderColor: theme.colors.tertiaryBorder,
      borderRadius: theme.radius.lg,
      borderWidth: 2,
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
    },
    selectedWordTitle: {
      flexShrink: 1,
    },
    selectedPodInner: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      gap: 2,
      padding: theme.spacing.sm,
    },
    viHighlight: {
      color: theme.colors.onTertiaryContainer,
      fontWeight: theme.typography.weight.bold,
      textDecorationLine: 'underline',
      textDecorationColor: theme.colors.tertiaryFixed,
    },
    grammarList: {
      gap: theme.spacing.sm,
    },
    grammarPod: {
      backgroundColor: theme.colors.secondarySoft,
      borderColor: theme.colors.secondaryContainer,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      gap: 2,
      padding: theme.spacing.sm,
    },
    formulaBox: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: 2,
    },
    formulaText: {
      fontFamily: 'monospace',
    },
    selectedWordHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    grammarHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    practiceWrap: {
      marginTop: theme.spacing.xs,
    },
    bottomBar: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderTopColor: theme.colors.surfaceHigh,
      borderTopWidth: StyleSheet.hairlineWidth,
      justifyContent: 'center',
      minHeight: 36,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
  });
}

function BlockSkeleton({
  testID,
  label,
  hint,
}: {
  testID: string;
  label: string;
  hint: string;
}) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View
      accessibilityHint={hint}
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      style={styles.skeleton}
      testID={testID}
    />
  );
}

function BlockError({
  message,
  onRetry,
  retrying,
  retryLabel,
  testID,
}: {
  message: string;
  onRetry: () => void;
  retrying: boolean;
  retryLabel: string;
  testID: string;
}) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.blockError} testID={testID}>
      <AppText color="danger">{message}</AppText>
      <AppButton
        loading={retrying}
        onPress={onRetry}
        testID={`${testID}-retry`}
        title={retryLabel}
        variant="secondary"
      />
    </View>
  );
}

function VocabRow({entry, testID}: {entry: VocabEntry; testID?: string}) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const note = entry.tip ?? entry.inSentenceNote;
  return (
    <View style={styles.vocabRow}>
      <AppText variant="bodyLg">
        {entry.word}
        <AppText color="muted"> · {entry.pos}</AppText>
      </AppText>
      {/* SETE-335 (TASK-8): IPA stands on its own line (mono), never glued
          to the meaning line. */}
      {entry.ipa ? (
        <AppText
          color="muted"
          style={styles.ipaText}
          testID={testID ? `${testID}-ipa` : undefined}
          variant="caption"
        >
          /{entry.ipa}/
        </AppText>
      ) : null}
      <AppText color="secondary">{entry.meaning}</AppText>
      {note ? (
        <AppText color="muted" variant="caption">
          {note}
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * SETE-329 (TASK-2) + SETE-330 (TASK-3): Sentence card with fixed 48pt header,
 * vertical scroll region, sticky pinned sentence on scroll past sentence,
 * bottom hint/prompt, and session scroll position memory.
 */
export function SentenceCard({
  videoId,
  segment,
  enrichment: initialEnrichment,
  retryBlock,
  testID,
  totalSegments,
  level,
  showTranslation: controlledShowTranslation,
  isSaved = false,
  onToggleSave,
  onPlaySentenceAudio,
  onPressWord,
  savedWordIds,
  onToggleWordSave,
  savedGrammarIds,
  onToggleGrammarSave,
  onPracticeSentence,
  onNextSentence,
  initialScrollOffset = 0,
  onScrollOffsetChange,
  width: customWidth,
}: SentenceCardProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const windowWidth = useWindowDimensions().width;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const cardWidth = customWidth ?? getCardWidth(windowWidth);

  const scrollViewRef = useRef<ScrollView>(null);
  const translationVisible = controlledShowTranslation ?? true;

  const [scrollY, setScrollY] = useState(0);
  const [sentenceBlockHeight, setSentenceBlockHeight] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(false);

  // Restore scroll offset from session memory on mount
  useEffect(() => {
    if (initialScrollOffset > 0) {
      scrollViewRef.current?.scrollTo({
        y: initialScrollOffset,
        animated: false,
      });
    }
  }, [initialScrollOffset]);

  const {enrichment, states, errors, retrying, retry} = useSentenceEnrichment({
    videoId,
    segmentIndex: segment.index,
    initialEnrichment,
    retryBlock,
  });

  const blockTestID = useCallback(
    (block: SentenceBlockId, suffix?: string) =>
      testID
        ? `${testID}-block-${block}${suffix ? `-${suffix}` : ''}`
        : undefined,
    [testID],
  );

  const retryLabel = t('youtube.sentence_retry', {defaultValue: 'Thử lại'});
  const blockErrorMessage = (block: SentenceBlockId) =>
    errors[block] ??
    t('youtube.sentence_block_error', {
      defaultValue: 'Không tải được khối này',
    });
  const skeletonHint = t('youtube.sentence_loading_hint', {
    defaultValue: 'Nội dung sẽ hiện khi tải xong',
  });
  const skeletonLabel = (block: SentenceBlockId) =>
    t('youtube.sentence_loading_block', {
      block: t(`youtube.sentence_${block}`, {defaultValue: block}),
      defaultValue: 'Đang tải…',
    });

  const keyword = resolveKeyword(segment.en, enrichment);

  // SETE-331 (TASK-4) & SETE-333 (a11y prefers-reduced-motion): interactive word selection.
  // Defaults to AI keyword; swapping words fades 120ms if prefers-reduced-motion or 150ms default.
  const [selectedWord, setSelectedWord] = useState(keyword);
  const [reduceMotion, setReduceMotion] = useState(false);
  const selectedFade = useRef(new Animated.Value(1)).current;
  const selectedBlockYRef = useRef(0);
  const scrollYRef = useRef(0);
  const viewportHeightRef = useRef(0);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    setSelectedWord(keyword);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment.en, enrichment?.keyWord]);

  useEffect(() => {
    selectedFade.setValue(0);
    const fade = Animated.timing(selectedFade, {
      duration: reduceMotion ? 120 : 150,
      toValue: 1,
      useNativeDriver: true,
    });
    fade.start();
    return () => fade.stop();
  }, [selectedWord, selectedFade, reduceMotion]);

  const wordTokens = useMemo(
    () => tokenizeSentenceWords(segment.en),
    [segment.en],
  );
  const selectedEntry = useMemo(
    () => findVocabEntry(enrichment?.vocab ?? [], selectedWord),
    [enrichment, selectedWord],
  );
  // SETE-335 (TASK-8): the VI span matching the selected word. Recomputes
  // on every selection change so the amber underline follows the tap.
  const viHighlight = useMemo(
    () => findViHighlight(segment.vi, selectedEntry),
    [segment.vi, selectedEntry],
  );
  const isSelectedWordSaved =
    savedWordIds?.has(selectedWord.toLowerCase()) ?? false;

  const handlePressWordToken = useCallback(
    (word: string) => {
      setSelectedWord(word);
      onPressWord?.(word);
      // Self-scroll the selected block into view when it sits below the
      // viewport (native animated scroll ≈300ms).
      const blockY = selectedBlockYRef.current;
      const viewportBottom =
        scrollYRef.current + viewportHeightRef.current - 120;
      if (viewportHeightRef.current > 0 && blockY > viewportBottom) {
        scrollViewRef.current?.scrollTo({
          animated: !reduceMotion,
          y: Math.max(0, blockY - 80),
        });
      }
    },
    [onPressWord, reduceMotion],
  );

  const handleSelectedBlockLayout = useCallback((e: LayoutChangeEvent) => {
    selectedBlockYRef.current = e.nativeEvent.layout.y;
  }, []);

  const handleScrollViewLayout = useCallback((e: LayoutChangeEvent) => {
    viewportHeightRef.current = e.nativeEvent.layout.height;
  }, []);

  const handleSentenceBlockLayout = useCallback((e: LayoutChangeEvent) => {
    setSentenceBlockHeight(e.nativeEvent.layout.height);
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = event.nativeEvent.contentOffset.y;
      setScrollY(currentY);
      scrollYRef.current = currentY;
      viewportHeightRef.current =
        event.nativeEvent.layoutMeasurement?.height ||
        viewportHeightRef.current;
      onScrollOffsetChange?.(segment.index, currentY);

      const layoutHeight = event.nativeEvent.layoutMeasurement?.height ?? 0;
      const contentHeight = event.nativeEvent.contentSize?.height ?? 0;
      const reachedBottom =
        contentHeight > 0 && currentY + layoutHeight >= contentHeight - 20;
      setIsAtBottom(reachedBottom);
    },
    [onScrollOffsetChange, segment.index],
  );

  const handleScrollToTop = useCallback(() => {
    scrollViewRef.current?.scrollTo({y: 0, animated: true});
  }, []);

  const isPinnedVisible = shouldShowPinnedSentence(
    scrollY,
    sentenceBlockHeight,
  );

  const grammarPoints = enrichment?.grammar ?? [];
  const grammarCount = grammarPoints.length;

  const hasLevelBadge = level != null && level.trim() !== '';

  return (
    <View style={[styles.card, {width: cardWidth}]} testID={testID}>
      {/* 48pt Fixed Header */}
      <View
        accessibilityHint={t('youtube.sentence_header_hint', {
          defaultValue: 'Phần đầu thẻ chứa thông tin câu',
        })}
        accessibilityLabel={`Câu ${segment.index + 1} trên ${
          totalSegments ?? 1
        }`}
        accessibilityRole="header"
        style={styles.header}
        testID={testID ? `${testID}-header` : undefined}
      >
        <View style={styles.headerLeft}>
          {hasLevelBadge ? (
            <Chip
              label={level}
              testID={testID ? `${testID}-level` : undefined}
              tone="neutral"
            />
          ) : null}
        </View>
        <View style={styles.headerRight}>
          <IconButton
            accessibilityHint={t('youtube.save_sentence_hint', {
              defaultValue: 'Lưu hoặc bỏ lưu câu này',
            })}
            accessibilityLabel={
              isSaved
                ? t('youtube.unsave_sentence_a11y', {
                    defaultValue: 'Bỏ lưu câu này',
                  })
                : t('youtube.save_sentence_a11y', {
                    defaultValue: 'Lưu câu này',
                  })
            }
            icon={isSaved ? 'bookmark' : 'bookmark_add'}
            onPress={onToggleSave}
            testID={testID ? `${testID}-toggle-save` : 'toggle-save'}
            tone={isSaved ? 'accent' : 'surface'}
          />
        </View>
      </View>

      {/* Fixed Emerald Audio Bar (immediate full-sentence listen + instruction + waveform) */}
      <View
        style={styles.listenBar}
        testID={testID ? `${testID}-listen-bar` : 'sentence-listen-bar'}
      >
        <IconButton
          accessibilityHint={t('youtube.sentence_pinned_audio_hint', {
            defaultValue: 'Nghe phát âm cả câu',
          })}
          accessibilityLabel={t('youtube.sentence_listen_all_a11y', {
            defaultValue: 'Nghe cả câu',
          })}
          icon="volume_up"
          onPress={() => onPlaySentenceAudio?.(segment)}
          size={PINNED_AUDIO_BUTTON_SIZE_PT}
          style={styles.listenAudioBtn}
          testID={testID ? `${testID}-listen-audio` : 'sentence-listen-audio'}
          tone="accent"
        />
        <View
          accessibilityElementsHidden={true}
          importantForAccessibility="no-hide-descendants"
          style={styles.waveform}
          testID={testID ? `${testID}-waveform` : undefined}
        >
          <View style={[styles.waveformBar, styles.waveformBar1]} />
          <View style={[styles.waveformBar, styles.waveformBar2]} />
          <View style={[styles.waveformBar, styles.waveformBar3]} />
          <View style={[styles.waveformBar, styles.waveformBar4]} />
          <View style={[styles.waveformBar, styles.waveformBar5]} />
          <View style={[styles.waveformBar, styles.waveformBar6]} />
        </View>
        <AppText
          numberOfLines={1}
          style={styles.listenHintText}
          testID={testID ? `${testID}-listen-hint` : 'sentence-listen-hint'}
          variant="caption"
        >
          {t('youtube.sentence_tap_word_hint', {
            defaultValue: 'Chạm từng từ để tra nghĩa & nghe phát âm lẻ',
          })}
        </AppText>
      </View>

      {/* Sticky Pinned Sentence (shows when scrolled past sentence block) */}
      {isPinnedVisible ? (
        <Pressable
          accessibilityHint={t('youtube.sentence_scroll_to_top_hint', {
            defaultValue: 'Chạm để cuộn về đầu thẻ',
          })}
          accessibilityLabel={t('youtube.sentence_scroll_to_top_a11y', {
            defaultValue: 'Cuộn về đầu thẻ',
          })}
          accessibilityRole="button"
          onPress={handleScrollToTop}
          style={styles.pinnedBar}
          testID={testID ? `${testID}-pinned-sentence` : 'pinned-sentence'}
        >
          <AppText
            ellipsizeMode="tail"
            numberOfLines={1}
            style={styles.pinnedText}
            testID={
              testID ? `${testID}-pinned-sentence-text` : 'pinned-sentence-text'
            }
          >
            {segment.en}
          </AppText>
          <IconButton
            accessibilityHint={t('youtube.sentence_pinned_audio_hint', {
              defaultValue: 'Nghe phát âm cả câu',
            })}
            accessibilityLabel={t('youtube.sentence_pinned_audio_a11y', {
              defaultValue: 'Nghe câu này',
            })}
            icon="volume_up"
            onPress={() => onPlaySentenceAudio?.(segment)}
            size={PINNED_AUDIO_BUTTON_SIZE_PT}
            style={styles.pinnedAudioBtn}
            testID={testID ? `${testID}-pinned-audio` : 'pinned-audio'}
            tone="surface"
          />
        </Pressable>
      ) : null}

      {/* Vertical Scroll Region */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        nestedScrollEnabled={false}
        onLayout={handleScrollViewLayout}
        onScroll={handleScroll}
        ref={scrollViewRef}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        testID={testID ? `${testID}-scroll` : undefined}
      >
        {/* 1. Sentence Block (per-word touch pills; punctuation untappable) */}
        <View
          onLayout={handleSentenceBlockLayout}
          style={styles.sentenceBlock}
          testID={testID ? `${testID}-sentence-block` : undefined}
        >
          {onPressWord ? (
            // Note: no accessibilityLabel on the row itself — each pill is
            // individually labeled so screen readers land on every word.
            <View
              style={styles.wordTokens}
              testID={testID ? `${testID}-en` : undefined}
            >
              {wordTokens.map((token, tokenIndex) => {
                if (!token.tappable) {
                  // Whitespace is covered by the row `gap`; punctuation
                  // renders as plain text — never tappable, no word testID.
                  if (token.text.trim() === '') {
                    return null;
                  }
                  return (
                    <AppText key={`${tokenIndex}-${token.text}`} variant="body">
                      {token.text}
                    </AppText>
                  );
                }
                const isSelected =
                  token.text.toLowerCase() === selectedWord.toLowerCase();
                return (
                  <Pressable
                    accessibilityHint={t('youtube.speak_word_hint', {
                      defaultValue: 'Chạm để nghe phát âm từ này',
                    })}
                    accessibilityLabel={token.text}
                    accessibilityRole="button"
                    accessibilityState={{selected: isSelected}}
                    // Pill stays ~32pt visually; hitSlop lifts the effective
                    // touch area to 32 + 2×8 = 48pt (spec §12: ≥44pt).
                    hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                    key={`${tokenIndex}-${token.text}`}
                    onPress={() => handlePressWordToken(token.text)}
                    style={[
                      styles.wordPill,
                      isSelected && styles.wordPillSelected,
                    ]}
                    testID={
                      testID
                        ? `${testID}-word-${tokenIndex}`
                        : `sentence-word-${tokenIndex}`
                    }
                  >
                    <AppText
                      style={[
                        styles.wordPillText,
                        isSelected && styles.wordPillTextSelected,
                      ]}
                      variant="body"
                    >
                      {token.text}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <AppText
              selectable={true}
              testID={testID ? `${testID}-en` : undefined}
              variant="bodyLg"
            >
              {segment.en}
            </AppText>
          )}
        </View>

        {/* 2. Translation Block (VI): slate box + dynamic amber underline
            following the selected word */}
        {translationVisible && segment.vi !== '' ? (
          <View
            style={styles.translationBox}
            testID={testID ? `${testID}-vi-wrap` : undefined}
          >
            <View style={styles.translationRow}>
              <View style={styles.viBadge}>
                <AppText color="muted" variant="caption">
                  VI
                </AppText>
              </View>
              <AppText
                color="secondary"
                selectable={true}
                style={styles.translationText}
                testID={testID ? `${testID}-vi` : undefined}
              >
                {viHighlight ? (
                  <>
                    {viHighlight.before}
                    <AppText
                      selectable={true}
                      style={styles.viHighlight}
                      testID={
                        testID ? `${testID}-vi-highlight` : 'vi-highlight'
                      }
                    >
                      {viHighlight.match}
                    </AppText>
                    {viHighlight.after}
                  </>
                ) : (
                  segment.vi
                )}
              </AppText>
            </View>
          </View>
        ) : null}

        {/* 3. Selected Keyword Block */}
        {states.keyword === 'pending' ? (
          <BlockSkeleton
            hint={skeletonHint}
            label={skeletonLabel('keyword')}
            testID={blockTestID('keyword', 'skeleton') ?? 'keyword-skeleton'}
          />
        ) : states.keyword === 'failed' ? (
          <BlockError
            message={blockErrorMessage('keyword')}
            onRetry={() => fireAndForget(retry('keyword'))}
            retrying={retrying.keyword}
            retryLabel={retryLabel}
            testID={blockTestID('keyword', 'error') ?? 'keyword-error'}
          />
        ) : (
          <Animated.View
            onLayout={handleSelectedBlockLayout}
            style={[styles.selectedPod, {opacity: selectedFade}]}
            testID={blockTestID('keyword', 'value')}
          >
            <View style={styles.selectedWordHeader}>
              <AppText
                selectable={true}
                style={styles.selectedWordTitle}
                testID={testID ? `${testID}-selected-word` : 'selected-word'}
                variant="bodyLg"
              >
                {selectedWord}
              </AppText>
              {selectedEntry ? (
                <Chip
                  label={selectedEntry.pos}
                  testID={testID ? `${testID}-selected-pos` : 'selected-pos'}
                  tone="gold"
                />
              ) : null}
              {onToggleWordSave ? (
                <AppButton
                  accessibilityHint={t('youtube.save_word_hint', {
                    defaultValue: 'Lưu hoặc bỏ lưu từ này',
                  })}
                  iconLeft={isSelectedWordSaved ? 'bookmark' : 'bookmark_add'}
                  onPress={() => onToggleWordSave(selectedWord, selectedEntry)}
                  testID={
                    testID ? `${testID}-word-toggle-save` : 'word-toggle-save'
                  }
                  title={
                    isSelectedWordSaved
                      ? t('youtube.unsave_word_title', {
                          defaultValue: 'Bỏ lưu từ',
                        })
                      : t('youtube.save_word_title', {defaultValue: 'Lưu từ'})
                  }
                  variant="secondary"
                />
              ) : null}
            </View>
            {/* IPA on its own line (mono), never glued to the meaning. */}
            {selectedEntry?.ipa ? (
              <AppText
                color="muted"
                selectable={true}
                style={styles.ipaText}
                testID={testID ? `${testID}-selected-ipa` : 'selected-ipa'}
                variant="caption"
              >
                /{selectedEntry.ipa}/
              </AppText>
            ) : null}
            {selectedEntry ? (
              isFunctionWordEntry(selectedEntry) ? (
                <AppText color="muted" selectable={true} variant="caption">
                  {formatFunctionWordNote(selectedEntry)}
                </AppText>
              ) : (
                <View style={styles.selectedPodInner}>
                  <AppText color="secondary" selectable={true}>
                    {t('youtube.word_meaning_label', {
                      defaultValue: 'Nghĩa',
                    })}
                    {`: ${selectedEntry.meaning}`}
                  </AppText>
                  {selectedEntry.tip ?? selectedEntry.inSentenceNote ? (
                    <AppText color="muted" selectable={true} variant="caption">
                      {t('youtube.word_tip_label', {
                        defaultValue: 'Mẹo nhớ',
                      })}
                      {`: ${selectedEntry.tip ?? selectedEntry.inSentenceNote}`}
                    </AppText>
                  ) : null}
                </View>
              )
            ) : null}
          </Animated.View>
        )}

        {/* 4. Vocab Block */}
        {states.vocab === 'pending' ? (
          <BlockSkeleton
            hint={skeletonHint}
            label={skeletonLabel('vocab')}
            testID={blockTestID('vocab', 'skeleton') ?? 'vocab-skeleton'}
          />
        ) : states.vocab === 'failed' ? (
          <BlockError
            message={blockErrorMessage('vocab')}
            onRetry={() => fireAndForget(retry('vocab'))}
            retrying={retrying.vocab}
            retryLabel={retryLabel}
            testID={blockTestID('vocab', 'error') ?? 'vocab-error'}
          />
        ) : states.vocab === 'ready' ? (
          <View testID={blockTestID('vocab', 'value')}>
            {(enrichment?.vocab ?? []).map(entry => (
              <VocabRow entry={entry} key={entry.word} />
            ))}
          </View>
        ) : null}

        {/* 5. Grammar Block */}
        {states.grammar === 'pending' ? (
          <BlockSkeleton
            hint={skeletonHint}
            label={skeletonLabel('grammar')}
            testID={blockTestID('grammar', 'skeleton') ?? 'grammar-skeleton'}
          />
        ) : states.grammar === 'failed' ? (
          <BlockError
            message={blockErrorMessage('grammar')}
            onRetry={() => fireAndForget(retry('grammar'))}
            retrying={retrying.grammar}
            retryLabel={retryLabel}
            testID={blockTestID('grammar', 'error') ?? 'grammar-error'}
          />
        ) : states.grammar === 'ready' ? (
          <View
            style={styles.grammarList}
            testID={blockTestID('grammar', 'value')}
          >
            {grammarPoints.map((point, pointIndex) => {
              const grammarSaved = savedGrammarIds?.has(point.name) ?? false;
              return (
                <View
                  key={point.name}
                  style={styles.grammarPod}
                  testID={
                    testID
                      ? `${testID}-grammar-point-${pointIndex}`
                      : `grammar-point-${pointIndex}`
                  }
                >
                  <View style={styles.grammarHeader}>
                    <Chip
                      label={formatGrammarBadge(pointIndex, grammarCount)}
                      testID={
                        testID
                          ? `${testID}-grammar-badge-${pointIndex}`
                          : `grammar-badge-${pointIndex}`
                      }
                      tone="neutral"
                    />
                    {onToggleGrammarSave ? (
                      <IconButton
                        accessibilityHint={t('youtube.save_grammar_hint', {
                          defaultValue: 'Lưu hoặc bỏ lưu điểm ngữ pháp này',
                        })}
                        accessibilityLabel={
                          grammarSaved
                            ? t('youtube.unsave_grammar_a11y', {
                                defaultValue: 'Bỏ lưu điểm ngữ pháp này',
                              })
                            : t('youtube.save_grammar_a11y', {
                                defaultValue: 'Lưu điểm ngữ pháp này',
                              })
                        }
                        icon={grammarSaved ? 'bookmark' : 'bookmark_add'}
                        onPress={() => onToggleGrammarSave(point)}
                        testID={
                          testID
                            ? `${testID}-grammar-save-${pointIndex}`
                            : `grammar-save-${pointIndex}`
                        }
                        tone={grammarSaved ? 'accent' : 'surface'}
                      />
                    ) : null}
                  </View>
                  <AppText selectable={true} variant="bodyLg">
                    {point.name}
                  </AppText>
                  {point.description !== '' ? (
                    <AppText
                      color="secondary"
                      selectable={true}
                      testID={
                        testID
                          ? `${testID}-grammar-description-${pointIndex}`
                          : `grammar-description-${pointIndex}`
                      }
                    >
                      {point.description}
                    </AppText>
                  ) : null}
                  {point.formula !== '' ? (
                    <View style={styles.formulaBox}>
                      <AppText
                        testID={
                          testID
                            ? `${testID}-grammar-formula-${pointIndex}`
                            : `grammar-formula-${pointIndex}`
                        }
                        variant="caption"
                      >
                        {t('youtube.grammar_formula_label', {
                          defaultValue: 'Công thức',
                        })}
                        {': '}
                        <AppText
                          selectable={true}
                          style={styles.formulaText}
                          variant="caption"
                        >
                          {point.formula}
                        </AppText>
                      </AppText>
                    </View>
                  ) : null}
                  <AppText color="secondary" selectable={true}>
                    {point.analysis}
                  </AppText>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* 6. Practice Block */}
        {onPracticeSentence ? (
          <View
            style={styles.practiceWrap}
            testID={testID ? `${testID}-practice-wrap` : undefined}
          >
            <AppButton
              onPress={() => onPracticeSentence(segment)}
              testID={testID ? `${testID}-practice-button` : undefined}
              title={t('youtube.practice_title', {
                defaultValue: 'Luyện nói câu này',
              })}
              variant="secondary"
            />
          </View>
        ) : null}
      </ScrollView>

      {/* Bottom Hint / Next Sentence Prompt */}
      <View
        style={styles.bottomBar}
        testID={testID ? `${testID}-bottom-bar` : undefined}
      >
        {totalSegments && segment.index < totalSegments - 1 ? (
          isAtBottom || grammarCount === 0 ? (
            <Pressable
              accessibilityHint={t('youtube.next_sentence_hint', {
                defaultValue: 'Chuyển sang câu kế tiếp',
              })}
              accessibilityLabel={formatNextSentencePrompt(segment.index + 2)}
              accessibilityRole="button"
              onPress={onNextSentence}
              testID={
                testID ? `${testID}-bottom-next-prompt` : 'bottom-next-prompt'
              }
            >
              <AppText color="muted" variant="caption">
                {formatNextSentencePrompt(segment.index + 2)}
              </AppText>
            </Pressable>
          ) : (
            <AppText
              color="muted"
              testID={
                testID ? `${testID}-bottom-grammar-hint` : 'bottom-grammar-hint'
              }
              variant="caption"
            >
              {formatGrammarBottomHint(grammarCount)}
            </AppText>
          )
        ) : totalSegments && segment.index === totalSegments - 1 ? (
          <AppText
            color="muted"
            testID={testID ? `${testID}-bottom-completed` : 'bottom-completed'}
            variant="caption"
          >
            {t('youtube.sentence_bottom_completed', {
              defaultValue: 'Hoàn thành bài',
            })}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
