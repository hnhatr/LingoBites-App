/**
 * HomeTodaySuggestion — compact "Kế hoạch hôm nay" card under the hero (F12).
 *
 * Shows only the day's plan progress; the step list lives on `Today`:
 *   [Kế hoạch hôm nay ................ 🎯 20 phút ▾]
 *   [▓▓▓▓░░░░ 1/3 bước ....... Xem chi tiết ›]
 *   [footer: weekly goal row]
 *
 * The mode button opens the 5/20/45-minute chips in place; picking one closes
 * them. Progress counts steps, not minutes: a plan can be shorter than the
 * chosen mode when there is not enough to study. The hero owns the primary
 * action. The whole progress row opens the full `Today` route with the
 * selected mode.
 */
import React, {type ReactNode, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import type {TodayMode} from '@features/today';

import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {TodayProgressModel} from '../logic/todayProgress';
import {getHardShadow} from './HomeDecorations';
import {HomeSectionTitle} from './HomeSectionTitle';

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
  progress: TodayProgressModel | null;
  onModeChange: (mode: TodayMode) => void;
  onViewDetails: () => void;
  /** Rendered under the plan, e.g. the weekly goal row. */
  footer?: ReactNode;
};

export function HomeTodaySuggestion({
  mode,
  progress,
  onModeChange,
  onViewDetails,
  footer,
}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [modesOpen, setModesOpen] = useState(false);

  const selectedMode =
    MODE_OPTIONS.find(option => option.mode === mode) ?? MODE_OPTIONS[1];
  const hasSteps = progress != null && progress.steps.length > 0;
  const totalSteps = progress
    ? progress.steps.length + progress.hiddenStepCount
    : 0;
  const doneSteps = progress ? progress.doneIds.size : 0;
  const ratio = totalSteps > 0 ? Math.min(1, doneSteps / totalSteps) : 0;

  return (
    <View style={styles.card} testID="home-today-suggestion">
      <View style={styles.headerRow}>
        <HomeSectionTitle title={t('home.today_label')} />
        <Pressable
          accessibilityHint={t('home.today_mode_toggle_hint')}
          accessibilityLabel={t('home.today_mode_toggle_a11y', {
            minutes: selectedMode.minutes,
          })}
          accessibilityRole="button"
          accessibilityState={{expanded: modesOpen}}
          hitSlop={8}
          onPress={() => setModesOpen(open => !open)}
          style={({pressed}) => [styles.modeToggle, pressed && styles.pressed]}
          testID="home-today-mode-toggle"
        >
          <AppText style={styles.modeToggleText}>
            {t(selectedMode.labelKey)}
          </AppText>
          <View style={modesOpen ? styles.chevronUp : styles.chevronDown}>
            <MaterialIcon
              color={theme.colors.text.primary}
              name="chevron_right"
              size={18}
            />
          </View>
        </Pressable>
      </View>

      {modesOpen ? (
        <View style={styles.modeRow}>
          {MODE_OPTIONS.map(option => (
            <Chip
              key={option.mode}
              accessibilityHint={t('home.today_mode_a11y', {
                minutes: option.minutes,
              })}
              label={t(option.labelKey)}
              selected={mode === option.mode}
              onPress={() => {
                onModeChange(option.mode);
                setModesOpen(false);
              }}
              testID={`home-today-mode-${option.mode}`}
            />
          ))}
        </View>
      ) : null}

      {hasSteps ? null : (
        <AppText style={styles.emptyText} testID="home-today-empty">
          {t('home.today_empty')}
        </AppText>
      )}

      <Pressable
        accessibilityHint={t('home.today_details_hint')}
        accessibilityLabel={
          hasSteps && !progress.allDone
            ? `${t('home.today_progress_a11y', {
                done: doneSteps,
                total: totalSteps,
              })}. ${t('home.today_details_a11y')}`
            : t('home.today_details_a11y')
        }
        accessibilityRole="button"
        onPress={onViewDetails}
        style={({pressed}) => [styles.footer, pressed && styles.pressed]}
        testID="home-today-details"
      >
        {hasSteps ? (
          progress.allDone ? (
            <AppText style={styles.allDone} testID="home-today-all-done">
              {t('home.today_all_done')}
            </AppText>
          ) : (
            <View style={styles.progressWrap} testID="home-today-progress">
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {width: `${Math.round(ratio * 100)}%`},
                  ]}
                />
              </View>
              <AppText style={styles.progressText}>
                {t('home.today_progress', {
                  done: doneSteps,
                  total: totalSteps,
                })}
              </AppText>
            </View>
          )
        ) : (
          <View style={styles.progressWrap} />
        )}
        <View style={styles.detailsLinkRow}>
          <AppText style={styles.detailsLink}>
            {t('home.today_details')}
          </AppText>
          <MaterialIcon
            color={theme.colors.primary}
            name="chevron_right"
            size={18}
          />
        </View>
      </Pressable>

      {footer}
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
    detailsLinkRow: {
      alignItems: 'center',
      flexDirection: 'row',
    },
    detailsLink: {
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    modeToggle: {
      alignItems: 'center',
      borderColor: theme.colors.ink,
      borderRadius: 999,
      borderWidth: 2,
      flexDirection: 'row',
      gap: 2,
      minHeight: 32,
      paddingLeft: 10,
      paddingRight: 6,
    },
    chevronDown: {
      transform: [{rotate: '90deg'}],
    },
    chevronUp: {
      transform: [{rotate: '-90deg'}],
    },
    modeToggleText: {
      color: theme.colors.text.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    modeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    stepRowPressed: {
      opacity: theme.states.pressedOpacity,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    emptyText: {
      color: theme.colors.text.secondary,
      fontSize: 13,
    },
    footer: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      minHeight: 44,
    },
    progressWrap: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      gap: 8,
    },
    progressTrack: {
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: 999,
      flex: 1,
      height: 8,
      overflow: 'hidden',
    },
    progressFill: {
      backgroundColor: theme.colors.secondary,
      borderRadius: 999,
      height: 8,
    },
    progressText: {
      color: theme.colors.text.secondary,
      fontSize: 12,
      fontWeight: '700',
    },
    allDone: {
      color: theme.colors.text.primary,
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
    },
  });
}
