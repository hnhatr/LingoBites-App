import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {vocabularyItemKey} from '@core/learning';
import type {AnalysisVocabularyItem} from '@core/schemas/lesson';

import type {VocabularySaveControl} from '../logic/useLessonSavedItems';
import {SaveItemButton} from './SaveItemButton';

export type WordBubbleProps = {
  /** The tapped word without surrounding punctuation. */
  word: string;
  /** IPA of the word (analysed entry first, else the sentence token). */
  ipa: string | null;
  /** Analysed entry for the word, when the sentence has one. */
  vocabulary: AnalysisVocabularyItem | null;
  onSpeakText?: (text: string) => void;
  vocabularySave?: VocabularySaveControl;
  onClose: () => void;
};

/**
 * Small card for a tapped word in the study card: IPA, meaning, listen and
 * "Lưu thẻ". Without an analysis it still shows the word, IPA and listen.
 */
export function WordBubble({
  word,
  ipa,
  vocabulary,
  onSpeakText,
  vocabularySave,
  onClose,
}: WordBubbleProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const title = vocabulary?.word ?? word;

  return (
    <View
      accessibilityLiveRegion="polite"
      style={styles.bubble}
      testID="youtube-word-bubble"
    >
      {onSpeakText ? (
        <IconButton
          accessibilityHint={t('lessonPlayer.speak_word_hint')}
          accessibilityLabel={t('lessonPlayer.speak_word', {word: title})}
          icon="volume_up"
          onPress={() => onSpeakText(title)}
          testID="youtube-word-bubble-speak"
          tone="ghost"
        />
      ) : null}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <AppText testID="youtube-word-bubble-word" variant="h3">
            {title}
          </AppText>
          {ipa ? (
            <AppText
              style={styles.ipa}
              testID="youtube-word-bubble-ipa"
              variant="body"
            >
              {`/${ipa}/`}
            </AppText>
          ) : null}
        </View>
        {vocabulary ? (
          <AppText color="secondary" variant="body">
            {`${vocabulary.pos} ${vocabulary.meaning}`}
          </AppText>
        ) : null}
        {vocabulary && vocabularySave ? (
          <SaveItemButton
            accessibilityHint={t('lessonPlayer.save_card_hint')}
            label={t('lessonPlayer.save_card')}
            onPress={() => vocabularySave.onToggle(vocabulary)}
            saved={vocabularySave.isSaved(
              vocabularyItemKey(vocabulary.word) ?? '',
            )}
            savedLabel={t('lessonPlayer.saved')}
            testID="youtube-word-bubble-save"
          />
        ) : null}
      </View>
      <IconButton
        accessibilityLabel={t('youtube.study.word_bubble_close')}
        icon="close"
        onPress={onClose}
        size={32}
        iconSize={18}
        testID="youtube-word-bubble-close"
        tone="bare"
      />
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    body: {
      flex: 1,
      gap: theme.spacing.xs,
      minWidth: 0,
    },
    bubble: {
      ...theme.shadow.medium,
      alignItems: 'flex-start',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.primary,
      borderRadius: theme.radius.lg,
      borderWidth: 1.5,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
    },
    ipa: {
      color: theme.colors.primary,
    },
    titleRow: {
      alignItems: 'baseline',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
  });
}
