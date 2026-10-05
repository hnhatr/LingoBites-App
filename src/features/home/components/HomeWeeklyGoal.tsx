/**
 * HomeWeeklyGoal — 5-paw weekly goal component (I3, P-004).
 *
 * Motion (AD-002):
 *   - I3 (paw fill animation): each paw fills progressively; static under reduced motion
 *   - I7 (confetti on goal met): disabled under reduced motion
 */
import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';
import {useReducedMotion} from 'react-native-reanimated';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {PawGoalModel, WeeklyGoalCardModel} from '../logic/homeScreenModel';
import {ConfettiParticles} from './HomeDecorations';
import {HomeIcon} from './HomeSvgIcons';

type Props = {
  pawGoal: PawGoalModel;
  /** Legacy weekly goal card model for ring + text (backward compat) */
  card: WeeklyGoalCardModel;
};

export function HomeWeeklyGoal({pawGoal, card}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const reducedMotion = useReducedMotion();
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
      {pawGoal.goalMet && (
        <ConfettiParticles
          visible={!reducedMotion}
          testID="home-goal-confetti"
        />
      )}

      {/* Paw prints (I3) */}
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
              size={24}
              color={
                filled ? theme.colors.secondary : theme.colors.surfaceContainer
              }
              testID={`home-paw-${i}`}
            />
          );
        })}
      </View>

      {/* Goal info */}
      <View style={styles.copy}>
        <AppText color="secondary" variant="caption">
          {t('home.weekly_goal_label')}
        </AppText>
        <AppText variant="label">{countLine}</AppText>
        <AppText color="muted" variant="caption">
          {hint}
        </AppText>
      </View>

      {/* Trophy icon */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={[styles.trophyWrap, {backgroundColor: theme.colors.accent}]}
      >
        <HomeIcon
          name="emoji_events"
          size={22}
          color={theme.colors.accentInk ?? '#fff'}
        />
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      flexDirection: 'row',
      gap: theme.spacing.md,
      overflow: 'hidden',
      padding: theme.spacing.md,
      ...theme.shadow.soft,
    },
    pawRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
    },
    copy: {
      flex: 1,
      gap: 4,
      minWidth: 0,
    },
    trophyWrap: {
      alignItems: 'center',
      borderRadius: 10,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
  });
}
