import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonGrammarEntry} from '../logic/lessonHubContent';
import type {GrammarSaveControl} from '../logic/useLessonSavedItems';
import {SaveItemButton} from './SaveItemButton';

export type LessonGrammarSectionProps = {
  entries: LessonGrammarEntry[];
  /** "Đánh dấu" per grammar point; omitted = no bookmark buttons. */
  saveControl?: GrammarSaveControl;
};

/**
 * "Ngữ pháp trong ngữ cảnh": one card per grammar point with formula,
 * explanation, how it is used in this lesson, and examples.
 */
export function LessonGrammarSection({
  entries,
  saveControl,
}: LessonGrammarSectionProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  if (entries.length === 0) {
    return (
      <View testID="lesson-grammar-empty" style={themedStyles.empty}>
        <AppText color="secondary">{t('lessonPlayer.grammar_empty')}</AppText>
      </View>
    );
  }
  return (
    <View testID="lesson-grammar-section" style={styles.list}>
      {entries.map(entry => (
        <AppCard key={entry.key} testID={`lesson-grammar-${entry.key}`}>
          <View style={styles.card}>
            <View style={styles.chipWrap}>
              <Chip label={t('lessonPlayer.analysis_grammar')} tone="gold" />
            </View>
            <AppText variant="h3">{entry.name}</AppText>
            {entry.nameVi ? (
              <AppText color="secondary">{entry.nameVi}</AppText>
            ) : null}
            {entry.formula ? (
              <View style={styles.block}>
                <AppText color="muted" style={styles.label} variant="label">
                  {t('lessonPlayer.grammar_formula')}
                </AppText>
                <AppText style={themedStyles.formula}>{entry.formula}</AppText>
              </View>
            ) : null}
            {entry.explanation ? (
              <View style={styles.block}>
                <AppText color="muted" style={styles.label} variant="label">
                  {t('lessonPlayer.grammar_explanation')}
                </AppText>
                <AppText color="secondary" variant="bodyLg">
                  {entry.explanation}
                </AppText>
              </View>
            ) : null}
            {entry.inText ? (
              <View style={themedStyles.inText}>
                <AppText color="muted" style={styles.label} variant="label">
                  {t('lessonPlayer.grammar_in_text')}
                </AppText>
                <AppText variant="bodyLg">{entry.inText}</AppText>
              </View>
            ) : null}
            {entry.examples.length > 0 ? (
              <View style={styles.block}>
                <AppText color="muted" style={styles.label} variant="label">
                  {t('lessonPlayer.grammar_examples')}
                </AppText>
                {entry.examples.map(example => (
                  <View key={example.en} style={styles.example}>
                    <AppText variant="bodyLg">{example.en}</AppText>
                    {example.vi ? (
                      <AppText color="secondary">{example.vi}</AppText>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
            {saveControl ? (
              <SaveItemButton
                accessibilityHint={t('lessonPlayer.bookmark_grammar_hint')}
                label={t('lessonPlayer.bookmark_grammar')}
                onPress={() => saveControl.onToggle(entry.key)}
                saved={saveControl.isSaved(entry.key)}
                savedLabel={t('lessonPlayer.saved')}
                testID={`lesson-grammar-save-${entry.key}`}
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
    formula: {
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.md,
      color: theme.colors.primary,
      fontWeight: theme.typography.weight.medium,
      overflow: 'hidden',
      padding: theme.spacing.sm,
    },
    inText: {
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.lg,
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
    },
  });
}

const styles = StyleSheet.create({
  block: {
    gap: 4,
  },
  card: {
    gap: 10,
  },
  chipWrap: {
    alignSelf: 'flex-start',
  },
  example: {
    gap: 2,
  },
  label: {
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  list: {
    gap: 12,
  },
});
