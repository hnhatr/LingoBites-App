import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {SaveToggle} from '@ui/components/SaveToggle';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';

import {vocabularyItemKey} from '@core/learning';
import type {AnalysisVocabularyItem} from '@core/schemas/lesson';

import type {VocabularySaveControl} from '../logic/useLessonSavedItems';

export type WordBubbleProps = {
  /** The tapped word without surrounding punctuation. */
  word: string;
  /** IPA of the word (analysed entry first, else the sentence token). */
  ipa: string | null;
  /** Analysed entry for the word, when the sentence has one. */
  vocabulary: AnalysisVocabularyItem | null;
  onSpeakText?: (text: string) => void;
  vocabularySave?: VocabularySaveControl;
  /** Opens the sentence analysis; offered while the word has no meaning. */
  onAnalyze?: () => void;
  onClose: () => void;
};

/**
 * Meaning of a tapped word, shown inside its sentence card under the
 * sentence so it never covers the video: word with listen / save / close,
 * then IPA, then part of speech and meaning. Without an analysis it shows
 * the word, IPA and a link to analyse the sentence.
 */
export function WordBubble({
  word,
  ipa,
  vocabulary,
  onSpeakText,
  vocabularySave,
  onAnalyze,
  onClose,
}: WordBubbleProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const title = vocabulary?.word ?? word;
  const saved =
    vocabulary && vocabularySave
      ? vocabularySave.isSaved(vocabularyItemKey(vocabulary.word) ?? '')
      : false;

  return (
    <View
      accessibilityLiveRegion="polite"
      style={styles.strip}
      testID="youtube-word-bubble"
    >
      <View style={styles.titleRow}>
        <AppText
          numberOfLines={1}
          style={styles.title}
          testID="youtube-word-bubble-word"
          variant="h3"
        >
          {title}
        </AppText>
        {onSpeakText ? (
          <Pressable
            accessibilityHint={t('lessonPlayer.speak_word_hint')}
            accessibilityLabel={t('lessonPlayer.speak_word', {word: title})}
            accessibilityRole="button"
            onPress={() => onSpeakText(title)}
            style={({pressed}) => [
              styles.mini,
              pressed ? styles.pressed : null,
            ]}
            testID="youtube-word-bubble-speak"
          >
            <MaterialIcon
              color={theme.colors.primary}
              name="volume_up"
              size={17}
            />
          </Pressable>
        ) : null}
        {vocabulary && vocabularySave ? (
          <SaveToggle
            accessibilityHint={t('lessonPlayer.save_card_hint')}
            accessibilityLabel={
              saved ? t('lessonPlayer.saved') : t('lessonPlayer.save_card')
            }
            backdrop
            hitSlop={0}
            iconSize={17}
            onPress={() => vocabularySave.onToggle(vocabulary)}
            saved={saved}
            size={32}
            testID="youtube-word-bubble-save"
          />
        ) : null}
        <Pressable
          accessibilityLabel={t('youtube.study.word_bubble_close')}
          accessibilityRole="button"
          onPress={onClose}
          style={({pressed}) => [styles.mini, pressed ? styles.pressed : null]}
          testID="youtube-word-bubble-close"
        >
          <MaterialIcon color={theme.colors.primary} name="close" size={17} />
        </Pressable>
      </View>
      {ipa ? (
        <AppText
          style={styles.ipa}
          testID="youtube-word-bubble-ipa"
          variant="body"
        >
          {`/${ipa}/`}
        </AppText>
      ) : null}
      {vocabulary ? (
        <View style={styles.meaningRow}>
          {vocabulary.pos ? (
            <View style={styles.pos}>
              <AppText style={styles.posText} variant="caption">
                {vocabulary.pos}
              </AppText>
            </View>
          ) : null}
          <AppText
            style={styles.meaning}
            testID="youtube-word-bubble-meaning"
            variant="body"
          >
            {vocabulary.meaning}
          </AppText>
        </View>
      ) : onAnalyze ? (
        <AppText color="muted" variant="body">
          {t('youtube.study.word_no_meaning')}{' '}
          <AppText
            accessibilityHint={t('lessonPlayer.analyze_hint')}
            accessibilityRole="link"
            onPress={onAnalyze}
            style={styles.link}
            testID="youtube-word-bubble-analyze"
            variant="body"
          >
            {t('lessonPlayer.analyze')}
          </AppText>
        </AppText>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    ipa: {
      color: theme.colors.onTertiaryContainer,
    },
    link: {
      color: theme.colors.primary,
      fontWeight: '800',
      textDecorationLine: 'underline',
    },
    meaning: {
      color: theme.colors.text.primary,
      flexShrink: 1,
    },
    meaningRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    mini: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 10,
      height: 32,
      justifyContent: 'center',
      width: 32,
    },
    pos: {
      backgroundColor: theme.colors.secondarySoft,
      borderRadius: 7,
      marginTop: 2,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    posText: {
      color: theme.colors.onSecondaryContainer,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    strip: {
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: 16,
      gap: 2,
      paddingBottom: theme.spacing.sm,
      paddingLeft: theme.spacing.md,
      paddingRight: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
      ...getStickerEdge(3, theme.colors.tertiaryBorder),
    },
    title: {
      flex: 1,
      minWidth: 0,
    },
    titleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
    },
  });
}
