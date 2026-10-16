import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {
  levelColors,
  memoryLevel,
  memoryOf,
  tenseInfo,
} from '@features/patternTense';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useOptionalAppNavigation} from '@core/navigation';

import type {LessonTenseEntry} from '../logic/lessonHubContent';

/**
 * Vocab path P6 (design B): "Thì của bài" on the lesson hub. The tense's
 * name, how well it is remembered and its formula; "Luyện câu" opens a combo
 * set on the lesson's pattern (or word) with this tense picked first, and
 * "Xem bản đồ thì" opens the tense map.
 */
export function LessonTenseCard({tense}: {tense: LessonTenseEntry}) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const appNavigation = useOptionalAppNavigation();
  const formula = tenseInfo(tense.payload).forms?.affirmative ?? null;
  const level = memoryLevel(memoryOf(tense.code));
  const colors = levelColors(theme, level);
  const practiceCode = tense.practiceItemCode;

  return (
    <AppCard>
      <View style={styles.card} testID="lesson-tense-card">
        <Pressable
          accessibilityHint={t('lessonPlayer.tense_open_hint')}
          accessibilityRole="button"
          disabled={!appNavigation}
          onPress={() => appNavigation?.openTenseDetail(tense.code)}
          style={styles.header}
          testID="lesson-tense-name"
        >
          <View style={styles.names}>
            <AppText style={styles.name}>{tense.name}</AppText>
            {tense.meaningVi ? (
              <AppText color="secondary">{tense.meaningVi}</AppText>
            ) : null}
          </View>
          <View style={[styles.level, {backgroundColor: colors.face}]}>
            <AppText
              style={[styles.levelText, {color: colors.ink}]}
              testID="lesson-tense-level"
              variant="caption"
            >
              {t(`patternTense.level_${level}`)}
            </AppText>
          </View>
        </Pressable>
        {formula ? (
          <View style={styles.formula}>
            <AppText color="muted" variant="label">
              {t('lessonPlayer.tense_formula')}
            </AppText>
            <AppText style={styles.formulaText} testID="lesson-tense-formula">
              {formula}
            </AppText>
          </View>
        ) : null}
        {appNavigation && practiceCode ? (
          <AppButton
            accessibilityHint={t('lessonPlayer.tense_practice_hint')}
            iconLeft="bolt"
            onPress={() =>
              appNavigation.openComboSetup(practiceCode, tense.code)
            }
            testID="lesson-tense-practice"
            title={t('lessonPlayer.tense_practice')}
            variant="outline"
          />
        ) : null}
        {appNavigation ? (
          <Pressable
            accessibilityHint={t('lessonPlayer.tense_map_hint')}
            accessibilityRole="link"
            onPress={() => appNavigation.openLibrarySection('tenses')}
            testID="lesson-tense-map"
          >
            <AppText style={styles.link}>{t('lessonPlayer.tense_map')}</AppText>
          </Pressable>
        ) : null}
      </View>
    </AppCard>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      gap: theme.spacing.sm,
    },
    formula: {
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.md,
      gap: 2,
      padding: theme.spacing.sm,
    },
    formulaText: {
      fontWeight: '700',
    },
    header: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    level: {
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
    },
    levelText: {
      fontWeight: '700',
    },
    link: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    name: {
      fontSize: 18,
      fontWeight: '800',
    },
    names: {
      flex: 1,
      gap: 2,
    },
  });
}
