import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {IconButton} from '@ui/components/IconButton';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonPronunciationEntry} from '../logic/lessonHubContent';

export type LessonPronunciationSectionProps = {
  entries: LessonPronunciationEntry[];
  /** Speaks a word or sentence (TTS); omitted = no play buttons. */
  onSpeakText?: (text: string) => void;
};

/**
 * "Phát âm": the focus sound, a Vietnamese tip and minimal pairs to hear side
 * by side. Read-only: speaking is scored by the lesson flow player later.
 */
export function LessonPronunciationSection({
  entries,
  onSpeakText,
}: LessonPronunciationSectionProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  if (entries.length === 0) {
    return (
      <View testID="lesson-pronunciation-empty" style={themedStyles.empty}>
        <AppText color="secondary">
          {t('lessonPlayer.pronunciation_empty')}
        </AppText>
      </View>
    );
  }
  const speakButton = (text: string, testID: string) =>
    onSpeakText ? (
      <IconButton
        accessibilityHint={t('lessonPlayer.pattern_speak_hint')}
        accessibilityLabel={t('lessonPlayer.pattern_speak', {text})}
        icon="volume_up"
        onPress={() => onSpeakText(text)}
        testID={testID}
      />
    ) : null;
  return (
    <View testID="lesson-pronunciation-section" style={styles.list}>
      {entries.map(entry => {
        const testID = `lesson-pronunciation-${entry.key}`;
        return (
          <AppCard key={entry.key} testID={testID}>
            <View style={styles.card}>
              <View style={styles.chipWrap}>
                <Chip
                  label={t('lessonPlayer.pronunciation_chip')}
                  tone="accentSoft"
                />
              </View>
              <AppText variant="h3">{entry.text}</AppText>
              <AppText color="secondary">{entry.meaningVi}</AppText>
              <View style={styles.block}>
                <AppText color="muted" style={styles.label} variant="label">
                  {t('lessonPlayer.pronunciation_focus')}
                </AppText>
                <AppText variant="bodyLg">
                  {entry.focusIpa && entry.focusIpa !== entry.focus
                    ? `${entry.focus} · ${entry.focusIpa}`
                    : entry.focus}
                </AppText>
              </View>
              <View style={themedStyles.tip}>
                <AppText color="muted" style={styles.label} variant="label">
                  {t('lessonPlayer.pronunciation_tip')}
                </AppText>
                <AppText variant="bodyLg">{entry.tipVi}</AppText>
              </View>
              {entry.minimalPairs.length > 0 ? (
                <View style={styles.block}>
                  <AppText color="muted" style={styles.label} variant="label">
                    {t('lessonPlayer.pronunciation_pairs')}
                  </AppText>
                  {entry.minimalPairs.map(([first, second], index) => (
                    <View key={`${first}-${second}`} style={styles.pair}>
                      <View style={styles.pairWord}>
                        <AppText variant="bodyLg">{first}</AppText>
                        {speakButton(first, `${testID}-pair-${index}-a`)}
                      </View>
                      <AppText color="muted">·</AppText>
                      <View style={styles.pairWord}>
                        <AppText variant="bodyLg">{second}</AppText>
                        {speakButton(second, `${testID}-pair-${index}-b`)}
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
              {entry.examples.length > 0 ? (
                <View style={styles.block}>
                  <AppText color="muted" style={styles.label} variant="label">
                    {t('lessonPlayer.pattern_examples')}
                  </AppText>
                  {entry.examples.map((example, index) => (
                    <View key={`${index}-${example.en}`} style={styles.pair}>
                      <View style={styles.example}>
                        <AppText variant="bodyLg">{example.en}</AppText>
                        <AppText color="secondary">{example.vi}</AppText>
                      </View>
                      {speakButton(example.en, `${testID}-example-${index}`)}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </AppCard>
        );
      })}
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
    tip: {
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.lg,
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
    },
  });
}

const styles = StyleSheet.create({
  block: {
    gap: 6,
  },
  card: {
    gap: 10,
  },
  chipWrap: {
    alignSelf: 'flex-start',
  },
  example: {
    flex: 1,
    gap: 2,
  },
  label: {
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  list: {
    gap: 12,
  },
  pair: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  pairWord: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
});
