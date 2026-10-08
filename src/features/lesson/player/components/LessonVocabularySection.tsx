import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {SectionHeader} from '@ui/components/SectionHeader';
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

/**
 * "Từ vựng chính" / "Từ & cụm": lesson vocabulary as word cards. Catalog
 * lessons group their items into required and extended ones and mark how the
 * lesson introduces each (new, review, learned before).
 */
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
  const renderEntry = (entry: LessonVocabularyEntry) => {
    const introduction = entry.introduction ? (
      <Chip
        label={t(`lessonPlayer.item_intro_${entry.introduction}`)}
        testID={`lesson-vocabulary-intro-${entry.key}`}
        tone={entry.introduction === 'new' ? 'accentSoft' : 'neutral'}
      />
    ) : null;
    const save = saveControl ? (
      <SaveItemButton
        accessibilityHint={t('lessonPlayer.save_card_hint')}
        label={t('lessonPlayer.save_card')}
        onPress={() => saveControl.onToggle({...entry, id: entry.key})}
        saved={saveControl.isSaved(entry.word)}
        savedLabel={t('lessonPlayer.saved')}
        testID={`lesson-vocabulary-save-${entry.key}`}
      />
    ) : null;
    return (
      <WordCard
        key={entry.key}
        actions={
          introduction || save ? (
            <View style={styles.actions}>
              {introduction}
              {save}
            </View>
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
    );
  };
  const grouped = entries.some(entry => entry.role !== null);
  if (!grouped) {
    return (
      <View testID="lesson-vocabulary-section" style={styles.list}>
        {entries.map(renderEntry)}
      </View>
    );
  }
  const groups = (['required', 'extended'] as const)
    .map(role => ({
      role,
      entries: entries.filter(entry => (entry.role ?? 'required') === role),
    }))
    .filter(group => group.entries.length > 0);
  return (
    <View testID="lesson-vocabulary-section" style={styles.list}>
      {groups.map(group => (
        <View
          key={group.role}
          style={styles.list}
          testID={`lesson-vocabulary-group-${group.role}`}
        >
          <SectionHeader
            title={t(`lessonPlayer.vocabulary_group_${group.role}`)}
          />
          {group.entries.map(renderEntry)}
        </View>
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
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  list: {
    gap: 12,
  },
});
