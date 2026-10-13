/**
 * HomeWeeklyGoal — one-line weekly goal strip (LING-256, LING-267, §VS-3).
 *
 * Layout (footer of the "Hôm nay học gì?" card):
 *   [🏆 Tuần này  🐾🐾🐾🐾🐾🐾 ........ 2/6 · còn 4 bài]
 *
 * One paw per target lesson. The count line and the badge hint stay in the
 * accessibility label; the "+1 🐾" link lives on the hero card.
 */
import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {PawGoalModel, WeeklyGoalCardModel} from '../logic/homeScreenModel';
import {HOME_EMPTY_PAW, HOME_TROPHY} from '../logic/homeScreenModel';
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
      style={styles.row}
      testID="home-weekly-goal-card"
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={styles.trophyWrap}
      >
        <HomeIcon name="emoji_events" size={18} color={HOME_TROPHY} />
      </View>

      <AppText style={styles.label} numberOfLines={1}>
        {t('home.weekly_goal_label')}
      </AppText>

      {/* Paw row: one 16pt pets icon per lesson of the target */}
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
              size={16}
              color={filled ? theme.colors.secondary : HOME_EMPTY_PAW}
              testID={`home-paw-${i}`}
            />
          );
        })}
      </View>

      <AppText
        numberOfLines={1}
        style={styles.count}
        testID="home-weekly-goal-count"
      >
        {pawGoal.goalMet
          ? t('home.weekly_goal_compact', card.countLineParams)
          : t('home.weekly_goal_compact_left', {
              ...card.countLineParams,
              k: Math.max(
                0,
                card.countLineParams.target - card.countLineParams.n,
              ),
            })}
      </AppText>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceContainer,
      borderRadius: 12,
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    label: {
      color: theme.colors.text.secondary,
      flexShrink: 1,
      fontSize: 12,
      fontWeight: '700',
    },
    pawRow: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 2,
      minWidth: 0,
    },
    count: {
      color: theme.colors.text.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    trophyWrap: {
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
