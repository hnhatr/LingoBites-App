import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';

import type {LessonGrammarEntry} from '../logic/lessonHubContent';
import type {GrammarSaveControl} from '../logic/useLessonSavedItems';
import {BookmarkToggle, studyCardStyle, StudyLabel} from './StudyControls';

export type LessonGrammarSectionProps = {
  entries: LessonGrammarEntry[];
  /** "Đánh dấu" per grammar point; omitted = no bookmark buttons. */
  saveControl?: GrammarSaveControl;
};

/** The parts of a formula ("S + do/does not + V") as separate tiles. */
export function formulaParts(formula: string): string[] {
  return formula
    .split('+')
    .map(part => part.trim())
    .filter(Boolean);
}

/**
 * "Ngữ pháp trong ngữ cảnh": one card per grammar point with the formula as
 * coloured tiles, the explanation, how it is used in this lesson, and
 * examples. The bookmark sits in the card's corner.
 */
export function LessonGrammarSection({
  entries,
  saveControl,
}: LessonGrammarSectionProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const tileColors = useMemo(
    () => [
      {
        face: solidOver(theme.colors.secondarySoft, theme.colors.surface),
        ink: theme.colors.onSecondaryContainer,
      },
      {face: theme.colors.accentSoft, ink: theme.colors.primary},
      {
        face: solidOver(theme.colors.tertiarySoft, theme.colors.surface),
        ink: theme.colors.onTertiaryContainer,
      },
    ],
    [theme],
  );
  if (entries.length === 0) {
    return (
      <View testID="lesson-grammar-empty" style={styles.empty}>
        <AppText color="secondary">{t('lessonPlayer.grammar_empty')}</AppText>
      </View>
    );
  }
  return (
    <View testID="lesson-grammar-section" style={styles.list}>
      {entries.map((entry, index) => (
        <View
          key={entry.key}
          style={styles.card}
          testID={`lesson-grammar-${entry.key}`}
        >
          <View style={styles.head}>
            <View style={styles.headText}>
              <StudyLabel color={theme.colors.primary}>
                {t('lessonPlayer.grammar_point', {index: index + 1})}
              </StudyLabel>
              <AppText style={styles.name}>{entry.name}</AppText>
              {entry.nameVi ? (
                <AppText color="muted">{entry.nameVi}</AppText>
              ) : null}
            </View>
            {saveControl ? (
              <BookmarkToggle
                accessibilityHint={t('lessonPlayer.bookmark_grammar_hint')}
                label={t('lessonPlayer.bookmark_grammar')}
                onPress={() => saveControl.onToggle(entry.key)}
                saved={saveControl.isSaved(entry.key)}
                savedLabel={t('lessonPlayer.saved')}
                testID={`lesson-grammar-save-${entry.key}`}
              />
            ) : null}
          </View>

          {entry.formula ? (
            <View
              accessibilityLabel={`${t('lessonPlayer.grammar_formula')}: ${entry.formula}`}
              accessible
              style={styles.formula}
              testID={`lesson-grammar-formula-${entry.key}`}
            >
              {formulaParts(entry.formula).map((part, k) => {
                const color = tileColors[k % tileColors.length]!;
                return (
                  <React.Fragment key={`${k}-${part}`}>
                    {k > 0 ? <AppText style={styles.plus}>+</AppText> : null}
                    <View style={[styles.tile, {backgroundColor: color.face}]}>
                      <AppText style={[styles.tileText, {color: color.ink}]}>
                        {part}
                      </AppText>
                    </View>
                  </React.Fragment>
                );
              })}
            </View>
          ) : null}

          {entry.explanation ? (
            <AppText color="secondary" variant="bodyLg">
              {entry.explanation}
            </AppText>
          ) : null}

          {entry.inText ? (
            <View style={styles.inText}>
              <StudyLabel color={theme.colors.primary}>
                {t('lessonPlayer.grammar_in_text')}
              </StudyLabel>
              <AppText variant="bodyLg">{entry.inText}</AppText>
            </View>
          ) : null}

          {entry.examples.length > 0 ? (
            <View style={styles.block}>
              <StudyLabel>{t('lessonPlayer.grammar_examples')}</StudyLabel>
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
    list: {
      gap: 16,
    },
    card: {
      ...studyCardStyle(theme),
      gap: 12,
      padding: 16,
    },
    head: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 12,
    },
    headText: {
      flex: 1,
      gap: 1,
    },
    name: {
      color: theme.colors.text.primary,
      fontSize: 21,
      fontWeight: '800',
      lineHeight: 27,
    },
    formula: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 16,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      padding: 10,
    },
    tile: {
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    tileText: {
      fontSize: 13.5,
      fontWeight: '800',
    },
    plus: {
      color: theme.colors.text.muted,
      fontWeight: '800',
    },
    inText: {
      backgroundColor: theme.colors.accentSoft,
      borderBottomRightRadius: 14,
      borderLeftColor: theme.colors.accent,
      borderLeftWidth: 4,
      borderTopRightRadius: 14,
      gap: 3,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    block: {
      gap: 6,
    },
    example: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 14,
      gap: 2,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
  });
}
