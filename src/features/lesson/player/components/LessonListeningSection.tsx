import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {IconButton} from '@ui/components/IconButton';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonListeningEntry} from '../logic/lessonHubContent';

export type LessonListeningSectionProps = {
  entries: LessonListeningEntry[];
  /** Speaks the listening text (TTS); omitted = no play buttons. */
  onSpeakText?: (text: string) => void;
};

/**
 * "Nghe hiểu": listen (TTS until item audio ships), read the question, then
 * reveal the answer and the transcript. Not scored.
 */
export function LessonListeningSection({
  entries,
  onSpeakText,
}: LessonListeningSectionProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  if (entries.length === 0) {
    return (
      <View testID="lesson-listening-empty" style={themedStyles.empty}>
        <AppText color="secondary">{t('lessonPlayer.listening_empty')}</AppText>
      </View>
    );
  }
  return (
    <View testID="lesson-listening-section" style={styles.list}>
      {entries.map(entry => (
        <ListeningCard
          key={entry.key}
          entry={entry}
          onSpeakText={onSpeakText}
        />
      ))}
    </View>
  );
}

function ListeningCard({
  entry,
  onSpeakText,
}: {
  entry: LessonListeningEntry;
  onSpeakText?: (text: string) => void;
}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [revealed, setRevealed] = useState(false);
  const testID = `lesson-listening-${entry.key}`;
  return (
    <AppCard testID={testID}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Chip label={t('lessonPlayer.listening_chip')} tone="coralSoft" />
          {onSpeakText ? (
            <IconButton
              accessibilityHint={t('lessonPlayer.listening_play_hint')}
              accessibilityLabel={t('lessonPlayer.listening_play')}
              icon="volume_up"
              iconSize={28}
              onPress={() => onSpeakText(entry.text)}
              size={56}
              testID={`${testID}-play`}
              tone="accent"
            />
          ) : null}
        </View>
        <View style={styles.block}>
          <AppText color="muted" style={styles.label} variant="label">
            {t('lessonPlayer.listening_question')}
          </AppText>
          <AppText variant="h3">{entry.questionEn}</AppText>
          {entry.questionVi ? (
            <AppText color="secondary">{entry.questionVi}</AppText>
          ) : null}
        </View>
        {revealed ? (
          <View style={themedStyles.answer} testID={`${testID}-answer`}>
            <AppText color="muted" style={styles.label} variant="label">
              {t('lessonPlayer.listening_answer')}
            </AppText>
            <AppText variant="bodyLg">{entry.answer}</AppText>
            <AppText color="muted" style={styles.label} variant="label">
              {t('lessonPlayer.listening_transcript')}
            </AppText>
            <AppText variant="bodyLg">{entry.text}</AppText>
            <AppText color="secondary">{entry.meaningVi}</AppText>
          </View>
        ) : (
          <AppButton
            accessibilityHint={t('lessonPlayer.listening_reveal_hint')}
            onPress={() => setRevealed(true)}
            testID={`${testID}-reveal`}
            title={t('lessonPlayer.listening_reveal')}
            variant="outline"
          />
        )}
      </View>
    </AppCard>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    answer: {
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.lg,
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
    },
    empty: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
    },
  });
}

const styles = StyleSheet.create({
  block: {
    gap: 4,
  },
  card: {
    gap: 12,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  list: {
    gap: 12,
  },
});
