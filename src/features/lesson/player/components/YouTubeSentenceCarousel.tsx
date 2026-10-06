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

import {AnalysisIconButton} from '@ui/components/AnalysisIconButton';
import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonAnalysis, LessonSentence} from '@core/schemas/lesson';

import {formatCueLabel} from '../logic/canonicalYouTubeCues';

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
  onPressCard: (index: number, sentence: LessonSentence) => void;
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
  onPressCard,
  onSpeakText,
  onOpenAnalysis,
  theme,
  t,
}: CardProps) {
  const styles = useMemo(() => cardStyles(theme), [theme]);
  const cueTestSuffix = cueActive ? '-active' : '';
  const vocabWords = analysis?.vocabulary.map(item => item.word) ?? [];
  const grammarNames = analysis?.grammar.map(item => item.name) ?? [];

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
                <AnalysisIconButton
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
                  analyzed={analysis !== undefined}
                  onPress={() => onOpenAnalysis(sentence.id)}
                  testID={`youtube-open-analysis-${sentence.id}`}
                />
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
          <AppText testID={`youtube-cue-text-${sentence.id}`} variant="h3">
            {sentence.text_en}
          </AppText>
          {showIpa ? (
            <AppText color="muted" variant="body">
              {sentence.ipa}
            </AppText>
          ) : null}
          {showTranslation ? (
            <AppText color="secondary" variant="bodyLg">
              {sentence.text_vi}
            </AppText>
          ) : null}
          {vocabWords.length > 0 || grammarNames.length > 0 ? (
            <View style={styles.chipsSection}>
              {vocabWords.length > 0 ? (
                <View
                  accessibilityLabel={t('youtube.study.vocabulary_label')}
                  style={styles.chipRow}
                >
                  <View style={styles.vocabBadge}>
                    <MaterialIcon
                      color={theme.colors.primary}
                      name="menu_book"
                      size={16}
                    />
                  </View>
                  <View style={styles.chipWrap}>
                    {vocabWords.map(word => (
                      <View key={word} style={styles.chip}>
                        <AppText style={styles.chipText} variant="label">
                          {word}
                        </AppText>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              {grammarNames.length > 0 ? (
                <View
                  accessibilityLabel={t('youtube.study.grammar_label')}
                  style={styles.chipRow}
                >
                  <View style={styles.grammarBadge}>
                    <MaterialIcon
                      color={theme.colors.onTertiaryContainer}
                      name="school"
                      size={16}
                    />
                  </View>
                  <View style={styles.chipWrap}>
                    {grammarNames.map(name => (
                      <View key={name} style={styles.grammarChip}>
                        <AppText style={styles.grammarChipText} variant="label">
                          {name}
                        </AppText>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
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
  onPauseVideo,
  scrollAnimated = false,
  onScrollAnimationConsumed,
}: YouTubeSentenceCarouselProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const reducedMotion = useReducedMotion();
  const listStyles = useMemo(() => listStyleSheet(theme), [theme]);
  const [listWidth, setListWidth] = useState(0);
  const cardWidth = Math.max(listWidth - theme.spacing.lg, 280);

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
      onSpeakText,
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
    () => ({activeIndex, showTranslation, showIpa, currentIndex}),
    [activeIndex, currentIndex, showIpa, showTranslation],
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
    card: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      gap: theme.spacing.xs,
      padding: theme.spacing.lg,
    },
    cardHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 24,
    },
    cardOuter: {
      paddingRight: theme.spacing.sm,
    },
    cardSelected: {
      borderColor: theme.colors.primary,
      borderWidth: 2,
    },
    chip: {
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    chipRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    chipText: {
      color: theme.colors.primary,
    },
    chipWrap: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
    },
    chipsSection: {
      gap: theme.spacing.xs,
      marginTop: theme.spacing.xs,
    },
    grammarBadge: {
      alignItems: 'center',
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: theme.radius.pill,
      height: 28,
      justifyContent: 'center',
      width: 28,
    },
    grammarChipText: {
      color: theme.colors.onTertiaryContainer,
    },
    headerActions: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    vocabBadge: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.pill,
      height: 28,
      justifyContent: 'center',
      width: 28,
    },
    grammarChip: {
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    timestamp: {
      color: theme.colors.primary,
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
