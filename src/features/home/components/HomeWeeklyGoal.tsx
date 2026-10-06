/**
 * HomeWeeklyGoal — 5-paw weekly goal card (LING-256, LING-267, §VS-3).
 *
 * Layout:
 *   [Label -> 5 paws row -> Count line -> Hint] ... [26pt plain trophy]
 */
import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {PawGoalModel, WeeklyGoalCardModel} from '../logic/homeScreenModel';
import {HOME_EMPTY_PAW, HOME_TROPHY} from '../logic/homeScreenModel';
import {getHardShadow} from './HomeDecorations';
import {HomeIcon} from './HomeSvgIcons';

type Props = {
  pawGoal: PawGoalModel;
  card: WeeklyGoalCardModel;
};

export function HomeWeeklyGoal({pawGoal, card}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const countLine = t(card.countLineKey, card.countLineParams);
  const hint = card.hintParams
    ? t(card.hintKey, card.hintParams)
    : t(card.hintKey);
  const accessibilityLabel = t('home.weekly_goal_a11y', {
    line: countLine,
    ring: card.ringPercent,
    hint,
  });

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="summary"
      importantForAccessibility="yes"
      style={styles.card}
      testID="home-weekly-goal-card"
    >
      {/* Goal text column (§VS-3) */}
      <View style={styles.copy}>
        <AppText style={styles.label}>{t('home.weekly_goal_label')}</AppText>

        {/* 5-paw row: 22pt pets icons */}
        <View
          style={styles.pawRow}
          testID="home-paw-goal-row"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {Array.from({length: pawGoal.totalPaws}).map((_, i) => {
            const filled = i < pawGoal.filledPaws;
            return (
              <HomeIcon
                key={i}
                name="pets"
                size={22}
                color={filled ? theme.colors.secondary : HOME_EMPTY_PAW}
                testID={`home-paw-${i}`}
              />
            );
          })}
        </View>

        <AppText style={styles.countLine}>{countLine}</AppText>
        <AppText style={styles.hint}>{hint}</AppText>
      </View>

      {/* Right: Plain 26pt trophy (#d39b00), no background tile */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={styles.trophyWrap}
      >
        <HomeIcon name="emoji_events" size={26} color={HOME_TROPHY} />
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.ink,
      borderRadius: 20,
      borderWidth: 2,
      flexDirection: 'row',
      gap: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      ...getHardShadow(4, theme.colors.ink),
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    label: {
      color: theme.colors.text.secondary,
      fontSize: 12,
      fontWeight: '700',
    },
    pawRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
      marginBottom: 2,
      marginTop: 4,
    },
    countLine: {
      color: theme.colors.text.primary,
      fontSize: 15,
      fontWeight: '700',
    },
    hint: {
      color: theme.colors.text.muted,
      fontSize: 12,
      fontWeight: '600',
    },
    trophyWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 4,
    },
  });
}
