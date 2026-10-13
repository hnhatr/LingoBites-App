import React, {memo, useCallback, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  FlatList,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {useReducedMotion} from 'react-native-reanimated';

import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonAnalysis, LessonSentence} from '@core/schemas/lesson';

import {formatCueLabel} from '../logic/canonicalYouTubeCues';
import {
  normalizeIpa,
  pairWordsWithIpa,
  splitSentenceWords,
} from '../logic/sentenceIpa';

/** A word the learner tapped in a sentence card. */
export type SentenceWordSelection = {
  sentenceId: string;
  wordIndex: number;
  word: string;
  /** The word's own IPA token, when the sentence IPA pairs up. */
  ipa: string | null;
};

export type YouTubeSentenceCarouselProps = {
  sentences: LessonSentence[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  activeIndex: number | null;
  showTranslation: boolean;
  showIpa: boolean;
  analyses: Record<string, LessonAnalysis>;
  onSeek?: (positionMs: number) => void;
  onSpeakText?: (text: string) => void;
  onOpenAnalysis?: (sentenceId: string) => void;
  /** Tapping a word in a card (opens the word bubble). */
  onPressWord?: (selection: SentenceWordSelection) => void;
  /** The highlighted word, if any. */
  selectedWord?: Pick<SentenceWordSelection, 'sentenceId' | 'wordIndex'> | null;
  /** Called when a card is tapped, so the screen can pause the video. */
  onPauseVideo?: () => void;
  /** When true, the next currentIndex sync scrolls with animation (prev/next). */
  scrollAnimated?: boolean;
  onScrollAnimationConsumed?: () => void;
};

type CardProps = {
  sentence: LessonSentence;
  index: number;
  cardWidth: number;
  selected: boolean;
  cueActive: boolean;
  showTranslation: boolean;
  showIpa: boolean;
  analysis: LessonAnalysis | undefined;
  /** Index of the highlighted (tapped) word in this card, or null. */
  selectedWordIndex: number | null;
  onPressCard: (index: number, sentence: LessonSentence) => void;
  onPressWord?: (selection: SentenceWordSelection) => void;
  onSpeakText?: (text: string) => void;
  onOpenAnalysis?: (sentenceId: string) => void;
  theme: AppTheme;
  t: (key: string, options?: Record<string, unknown>) => string;
};

function SentenceCarouselCardBody({
  sentence,
  index,
  cardWidth,
  selected,
  cueActive,
  showTranslation,
  showIpa,
  analysis,
  selectedWordIndex,
  onPressCard,
  onPressWord,
  onSpeakText,
  onOpenAnalysis,
  theme,
  t,
}: CardProps) {
  const styles = useMemo(() => cardStyles(theme), [theme]);
  const cueTestSuffix = cueActive ? '-active' : '';
  const pairs = useMemo(
    () => pairWordsWithIpa(sentence.text_en, sentence.ipa),
    [sentence.ipa, sentence.text_en],
  );
  const words = useMemo(
    () =>
      pairs ??
      splitSentenceWords(sentence.text_en).map(word => ({word, ipa: null})),
    [pairs, sentence.text_en],
  );
  const interlinear = showIpa && pairs !== null;

  return (
    <View
      style={[styles.cardOuter, {width: cardWidth}]}
      testID={`canonical-sentence-${sentence.id}`}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{selected: cueActive}}
        testID={`youtube-cue-${sentence.id}${cueTestSuffix}`}
        onPress={() => onPressCard(index, sentence)}
      >
        <View
          style={[
            styles.card,
            selected || cueActive ? styles.cardSelected : null,
          ]}
        >
          <View style={styles.cardHeader}>
            <AppText
              testID={`youtube-cue-time-${sentence.id}`}
              style={styles.timestamp}
              variant="label"
            >
              {formatCueLabel(sentence.start_ms)}
            </AppText>
            <View style={styles.headerActions}>
              {onOpenAnalysis ? (
                <Pressable
                  accessibilityHint={
                    analysis
                      ? t('youtube.study.view_analysis_hint')
                      : t('lessonPlayer.analyze_hint')
                  }
                  accessibilityLabel={
                    analysis
                      ? t('youtube.study.view_analysis')
                      : t('lessonPlayer.analyze')
                  }
                  accessibilityRole="button"
                  onPress={() => onOpenAnalysis(sentence.id)}
                  style={({pressed}) => [
                    styles.analyzePill,
                    analysis ? styles.analyzePillDone : null,
                    pressed ? styles.pressed : null,
                  ]}
                  testID={`youtube-open-analysis-${sentence.id}`}
                >
                  <MaterialIcon
                    color={theme.colors.primary}
                    name="auto_awesome"
                    size={16}
                  />
                  <AppText style={styles.analyzeText} variant="label">
                    {t('youtube.study.analyze_short')}
                  </AppText>
                </Pressable>
              ) : null}
              {onSpeakText ? (
                <IconButton
                  accessibilityLabel={t('lessonPlayer.speak_sentence', {
                    index: index + 1,
                  })}
                  accessibilityHint={t('lessonPlayer.speak_sentence_hint')}
                  icon="volume_up"
                  onPress={() => onSpeakText(sentence.text_en)}
                  testID={`canonical-speak-${sentence.id}`}
                  tone="ghost"
                />
              ) : null}
            </View>
          </View>
          <View
            accessibilityLabel={sentence.text_en}
            style={[styles.words, interlinear ? styles.wordsInterlinear : null]}
            testID={`youtube-cue-text-${sentence.id}`}
          >
            {words.map((entry, wordIndex) => (
              <Pressable
                key={`${wordIndex}-${entry.word}`}
                accessibilityHint={t('youtube.study.word_hint')}
                accessibilityLabel={entry.word}
                accessibilityRole="button"
                disabled={!onPressWord}
                onPress={() =>
                  onPressWord?.({
                    sentenceId: sentence.id,
                    wordIndex,
                    word: entry.word,
                    ipa: entry.ipa,
                  })
                }
                style={[
                  styles.word,
                  selectedWordIndex === wordIndex ? styles.wordSelected : null,
                ]}
                testID={`youtube-word-${sentence.id}-${wordIndex}`}
              >
                <AppText variant="h3">{entry.word}</AppText>
                {interlinear && entry.ipa ? (
                  <AppText style={styles.wordIpa} variant="caption">
                    {entry.ipa}
                  </AppText>
                ) : null}
              </Pressable>
            ))}
          </View>
          {showIpa && !interlinear && sentence.ipa ? (
            <AppText color="muted" variant="body">
              {normalizeIpa(sentence.ipa)}
            </AppText>
          ) : null}
          {showTranslation ? (
            <View style={styles.translation}>
              <AppText color="secondary" variant="bodyLg">
                {sentence.text_vi}
              </AppText>
            </View>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

const SentenceCarouselCard = memo(SentenceCarouselCardBody);

export function YouTubeSentenceCarousel({
  sentences,
  currentIndex,
  onIndexChange,
  activeIndex,
  showTranslation,
  showIpa,
  analyses,
  onSeek,
  onSpeakText,
  onOpenAnalysis,
  onPressWord,
  selectedWord = null,
  onPauseVideo,
  scrollAnimated = false,
  onScrollAnimationConsumed,
}: YouTubeSentenceCarouselProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const reducedMotion = useReducedMotion();
  const listStyles = useMemo(() => listStyleSheet(theme), [theme]);
  const [listWidth, setListWidth] = useState(0);
  // One full-width card per page: no edge of the next card peeks in.
  const cardWidth = Math.max(listWidth, 280);

  const listRef = React.useRef<FlatList<LessonSentence>>(null);
  const pendingAnimatedScrollRef = React.useRef(false);
  // Only a finger drag may change the index from scroll events; animated
  // programmatic scrolls (video follow) also end in onMomentumScrollEnd and
  // would otherwise be mistaken for a manual swipe.
  const userDraggingRef = React.useRef(false);

  const scrollToIndex = useCallback(
    (index: number, animated: boolean) => {
      if (sentences.length === 0) return;
      userDraggingRef.current = false;
      const clamped = Math.max(0, Math.min(index, sentences.length - 1));
      listRef.current?.scrollToIndex({
        index: clamped,
        animated: reducedMotion ? false : animated,
      });
    },
    [reducedMotion, sentences.length],
  );

  React.useEffect(() => {
    if (scrollAnimated) {
      pendingAnimatedScrollRef.current = true;
    }
  }, [scrollAnimated]);

  React.useEffect(() => {
    const animated = pendingAnimatedScrollRef.current;
    pendingAnimatedScrollRef.current = false;
    scrollToIndex(currentIndex, animated);
    if (animated) {
      onScrollAnimationConsumed?.();
    }
  }, [currentIndex, onScrollAnimationConsumed, scrollToIndex]);

  const handlePressCard = useCallback(
    (index: number, sentence: LessonSentence) => {
      onIndexChange(index);
      if (sentence.start_ms !== null) {
        onSeek?.(sentence.start_ms);
      }
      onPauseVideo?.();
    },
    [onIndexChange, onPauseVideo, onSeek],
  );

  const renderItem = useCallback(
    ({item, index}: ListRenderItemInfo<LessonSentence>) => (
      <SentenceCarouselCard
        analysis={analyses[item.id]}
        cardWidth={cardWidth}
        cueActive={activeIndex === index}
        index={index}
        onOpenAnalysis={onOpenAnalysis}
        onPressCard={handlePressCard}
        onPressWord={onPressWord}
        selectedWordIndex={
          selectedWord?.sentenceId === item.id ? selectedWord.wordIndex : null
        }
        onSpeakText={onSpeakText}
        selected={currentIndex === index}
        sentence={item}
        showIpa={showIpa}
        showTranslation={showTranslation}
        t={t}
        theme={theme}
      />
    ),
    [
      activeIndex,
      analyses,
      cardWidth,
      currentIndex,
      handlePressCard,
      onOpenAnalysis,
      onPressWord,
      onSpeakText,
      selectedWord,
      showIpa,
      showTranslation,
      t,
      theme,
    ],
  );

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!userDraggingRef.current) return;
      userDraggingRef.current = false;
      if (cardWidth <= 0) return;
      const offsetX = event.nativeEvent.contentOffset.x;
      const next = Math.round(offsetX / cardWidth);
      onIndexChange(Math.max(0, Math.min(next, sentences.length - 1)));
    },
    [cardWidth, onIndexChange, sentences.length],
  );

  const extraData = useMemo(
    () => ({activeIndex, showTranslation, showIpa, currentIndex, selectedWord}),
    [activeIndex, currentIndex, selectedWord, showIpa, showTranslation],
  );

  if (sentences.length === 0) {
    return (
      <View style={listStyles.emptyWrap} testID="youtube-cards-empty">
        <AppText color="secondary">{t('youtube.study.empty_cards')}</AppText>
      </View>
    );
  }

  return (
    <View
      style={listStyles.listWrap}
      testID="youtube-sentence-carousel"
      onLayout={event => setListWidth(event.nativeEvent.layout.width)}
    >
      <FlatList
        ref={listRef}
        horizontal
        data={sentences}
        extraData={extraData}
        getItemLayout={(_, index) => ({
          index,
          length: cardWidth,
          offset: cardWidth * index,
        })}
        keyExtractor={item => item.id}
        pagingEnabled
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth}
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollBeginDrag={() => {
          userDraggingRef.current = true;
        }}
      />
    </View>
  );
}

function cardStyles(theme: AppTheme) {
  return StyleSheet.create({
    analyzePill: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: theme.spacing.xs,
      minHeight: 44,
      paddingHorizontal: theme.spacing.md,
    },
    analyzePillDone: {
      backgroundColor: theme.colors.accentSoft,
    },
    analyzeText: {
      color: theme.colors.primary,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
    },
    cardHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 24,
    },
    cardOuter: {
      paddingHorizontal: 2,
    },
    cardSelected: {
      borderColor: theme.colors.primary,
      borderWidth: 1.5,
    },
    headerActions: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    timestamp: {
      color: theme.colors.primary,
      fontVariant: ['tabular-nums'],
    },
    translation: {
      borderTopColor: theme.colors.outlineVariant,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: theme.spacing.sm,
    },
    word: {
      borderRadius: theme.radius.sm,
    },
    wordIpa: {
      color: theme.colors.primary,
      opacity: 0.8,
    },
    wordSelected: {
      backgroundColor: theme.colors.accentSoft,
    },
    words: {
      columnGap: 5,
      flexDirection: 'row',
      flexWrap: 'wrap',
      rowGap: 2,
    },
    wordsInterlinear: {
      columnGap: theme.spacing.sm,
      rowGap: theme.spacing.xs,
    },
  });
}

function listStyleSheet(theme: AppTheme) {
  return StyleSheet.create({
    emptyWrap: {
      paddingVertical: theme.spacing.lg,
    },
    listWrap: {
      minHeight: 200,
    },
  });
}
