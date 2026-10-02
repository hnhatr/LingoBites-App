import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {IconButton} from '@ui/components/IconButton';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonVocabularyEntry} from '../logic/lessonHubContent';

export type LessonVocabularySectionProps = {
  entries: LessonVocabularyEntry[];
  /** Speaks a word (TTS); omitted = no play buttons. */
  onSpeakText?: (text: string) => void;
};

/** "Từ vựng chính": lesson vocabulary as word cards. */
export function LessonVocabularySection({
  entries,
  onSpeakText,
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
        <AppCard key={entry.key} testID={`lesson-vocabulary-${entry.key}`}>
          <View style={styles.row}>
            <View style={styles.body}>
              <AppText variant="h3">{entry.word}</AppText>
              <View style={styles.meta}>
                {entry.ipa ? (
                  <AppText color="muted" variant="caption">
                    /{entry.ipa.replace(/^\/|\/$/g, '')}/
                  </AppText>
                ) : null}
                {entry.pos ? (
                  <Chip label={entry.pos} tone="accentSoft" />
                ) : null}
              </View>
              <AppText color="secondary" variant="bodyLg">
                {entry.meaning}
              </AppText>
            </View>
            {onSpeakText ? (
              <IconButton
                accessibilityLabel={t('lessonPlayer.speak_word', {
                  word: entry.word,
                })}
                accessibilityHint={t('lessonPlayer.speak_word_hint')}
                icon="volume_up"
                onPress={() => onSpeakText(entry.word)}
                testID={`lesson-vocabulary-speak-${entry.key}`}
                tone="accent"
              />
            ) : null}
          </View>
        </AppCard>
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
  body: {
    flex: 1,
    gap: 4,
  },
  list: {
    gap: 12,
  },
  meta: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
});
