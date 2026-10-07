import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {WordCard} from '@ui/components/WordCard';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonVocabularyEntry} from '../logic/lessonHubContent';
import type {VocabularySaveControl} from '../logic/useLessonSavedItems';
import {SaveItemButton} from './SaveItemButton';

export type LessonVocabularySectionProps = {
  entries: LessonVocabularyEntry[];
  /** Speaks a word (TTS); omitted = no play buttons. */
  onSpeakText?: (text: string) => void;
  /** "Lưu thẻ" per word; omitted = no save buttons. */
  saveControl?: VocabularySaveControl;
};

/** "Từ vựng chính": lesson vocabulary as word cards. */
export function LessonVocabularySection({
  entries,
  onSpeakText,
  saveControl,
}: LessonVocabularySectionProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  if (entries.length === 0) {
    return (
      <View testID="lesson-vocabulary-empty" style={themedStyles.empty}>
        <AppText color="secondary">
          {t('lessonPlayer.vocabulary_empty')}
        </AppText>
      </View>
    );
  }
  return (
    <View testID="lesson-vocabulary-section" style={styles.list}>
      {entries.map(entry => (
        <WordCard
          key={entry.key}
          actions={
            saveControl ? (
              <SaveItemButton
                accessibilityHint={t('lessonPlayer.save_card_hint')}
                label={t('lessonPlayer.save_card')}
                onPress={() => saveControl.onToggle({...entry, id: entry.key})}
                saved={saveControl.isSaved(entry.word)}
                savedLabel={t('lessonPlayer.saved')}
                testID={`lesson-vocabulary-save-${entry.key}`}
              />
            ) : undefined
          }
          ipa={entry.ipa}
          meaning={entry.meaning}
          onSpeak={onSpeakText ? () => onSpeakText(entry.word) : undefined}
          pos={entry.pos}
          speakAccessibilityHint={t('lessonPlayer.speak_word_hint')}
          speakAccessibilityLabel={t('lessonPlayer.speak_word', {
            word: entry.word,
          })}
          speakTestID={`lesson-vocabulary-speak-${entry.key}`}
          testID={`lesson-vocabulary-${entry.key}`}
          word={entry.word}
        />
      ))}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    empty: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
    },
  });
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
});
