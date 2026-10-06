/**
 * HomeTodaySuggestion — "Gợi ý hôm nay" card under the hero (F12).
 *
 * Brings the Today study-block engine onto Home so the learner sees a
 * suggestion as soon as the app opens:
 *   [Label ............................ Xem chi tiết]
 *   [⚡ 5 phút] [🎯 20 phút] [🔥 45 phút]
 *   [First activity row → starts it]
 *   [N hoạt động · ~T phút]
 *
 * "Xem chi tiết" opens the full `Today` route with the selected mode.
 */
import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import type {
  StudyActivityItem,
  StudyBlockPlan,
  TodayMode,
} from '@features/today';

import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {getHardShadow} from './HomeDecorations';

const MODE_OPTIONS: ReadonlyArray<{
  mode: TodayMode;
  labelKey: string;
  minutes: number;
}> = [
  {mode: '5-minute', labelKey: 'home.today_mode_5', minutes: 5},
  {mode: 'normal', labelKey: 'home.today_mode_20', minutes: 20},
  {mode: 'deep-practice', labelKey: 'home.today_mode_45', minutes: 45},
];

type Props = {
  mode: TodayMode;
  plan: StudyBlockPlan | null;
  onModeChange: (mode: TodayMode) => void;
  onStartActivity: (activity: StudyActivityItem) => void;
  onViewDetails: () => void;
};

export function HomeTodaySuggestion({
  mode,
  plan,
  onModeChange,
  onStartActivity,
  onViewDetails,
}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const firstActivity = plan?.activities[0] ?? null;

  return (
    <View style={styles.card} testID="home-today-suggestion">
      <View style={styles.headerRow}>
        <AppText style={styles.label}>{t('home.today_label')}</AppText>
        <Pressable
          accessibilityHint={t('home.today_details_hint')}
          accessibilityLabel={t('home.today_details_a11y')}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onViewDetails}
          testID="home-today-details"
        >
          <AppText style={styles.detailsLink}>
            {t('home.today_details')}
          </AppText>
        </Pressable>
      </View>

      <View style={styles.modeRow}>
        {MODE_OPTIONS.map(option => (
          <Chip
            key={option.mode}
            accessibilityHint={t('home.today_mode_a11y', {
              minutes: option.minutes,
            })}
            label={t(option.labelKey)}
            selected={mode === option.mode}
            onPress={() => onModeChange(option.mode)}
            testID={`home-today-mode-${option.mode}`}
          />
        ))}
      </View>

      {firstActivity ? (
        <Pressable
          accessibilityHint={t('home.today_start_hint')}
          accessibilityLabel={t('home.today_start_a11y', {
            title: firstActivity.titleVi,
            minutes: firstActivity.estimatedMinutes,
          })}
          accessibilityRole="button"
          onPress={() => onStartActivity(firstActivity)}
          style={({pressed}) => [
            styles.activityRow,
            pressed && styles.activityRowPressed,
          ]}
          testID="home-today-first-activity"
        >
          <View style={styles.activityCopy}>
            <AppText numberOfLines={1} style={styles.activityTitle}>
              {firstActivity.titleVi}
            </AppText>
            <AppText numberOfLines={1} style={styles.activitySubtitle}>
              {firstActivity.subtitleVi}
            </AppText>
          </View>
          <AppText style={styles.activityMinutes}>
            ~{firstActivity.estimatedMinutes}m
          </AppText>
          <MaterialIcon
            color={theme.colors.primary}
            name="play_arrow"
            size={22}
          />
        </Pressable>
      ) : (
        <AppText style={styles.emptyText} testID="home-today-empty">
          {t('home.today_empty')}
        </AppText>
      )}

      {plan && plan.activities.length > 0 ? (
        <AppText style={styles.summary} testID="home-today-summary">
          {t('home.today_summary', {
            count: plan.activities.length,
            minutes: plan.totalEstimatedMinutes,
          })}
        </AppText>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.ink,
      borderRadius: 20,
      borderWidth: 2,
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      ...getHardShadow(4, theme.colors.ink),
    },
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    label: {
      color: theme.colors.text.secondary,
      fontSize: 12,
      fontWeight: '700',
    },
    detailsLink: {
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    modeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    activityRow: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: 14,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    activityRowPressed: {
      opacity: theme.states.pressedOpacity,
    },
    activityCopy: {
      flex: 1,
      minWidth: 0,
    },
    activityTitle: {
      color: theme.colors.text.primary,
      fontSize: 15,
      fontWeight: '700',
    },
    activitySubtitle: {
      color: theme.colors.text.secondary,
      fontSize: 12,
    },
    activityMinutes: {
      color: theme.colors.text.secondary,
      fontSize: 12,
      fontWeight: '600',
    },
    emptyText: {
      color: theme.colors.text.secondary,
      fontSize: 13,
    },
    summary: {
      color: theme.colors.text.secondary,
      fontSize: 12,
    },
  });
}
