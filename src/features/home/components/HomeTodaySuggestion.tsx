/**
 * HomeTodaySuggestion — "Hôm nay học gì?" plan card under the hero (F12).
 *
 * Shows what to study today and what is left, without leaving Home:
 *   [Hôm nay học gì? ................... 🎯 20 phút ▾]
 *   [Còn 2 việc · khoảng 12 phút]
 *   [▓▓▓ ▒▒▒ ░░░]                    one segment per plan step
 *   [✓ Ôn thẻ đến hạn]               done
 *   [2 TIẾP THEO Bài mới …  Bắt đầu ›] next step, highlighted
 *   [3 Shadowing …                 ›]
 *   [+1 việc nữa ......... Xem cả ngày ›]
 *   [footer: weekly goal strip]
 *
 * The mode button opens the 5/20/45-minute chips in place; picking one closes
 * them. Progress counts steps, not minutes: a plan can be shorter than the
 * chosen mode when there is not enough to study. Each step row opens its
 * activity; the details row opens the full `Today` route with the mode.
 */
import React, {type ReactNode, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import type {StudyActivityItem, TodayMode} from '@features/today';

import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {TodayProgressModel} from '../logic/todayProgress';
import {getStickerEdge} from './HomeDecorations';
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
  onStartActivity: (activity: StudyActivityItem) => void;
  /** Rendered under the plan, e.g. the weekly goal row. */
  footer?: ReactNode;
};

export function HomeTodaySuggestion({
  mode,
  progress,
  onModeChange,
  onViewDetails,
  onStartActivity,
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
  const leftSteps = Math.max(0, totalSteps - doneSteps);
  const leftMinutes = progress
    ? Math.max(0, progress.totalMinutes - progress.doneMinutes)
    : 0;
  const nextId = progress?.nextActivity?.id ?? null;

  let summary: string | null = null;
  if (hasSteps) {
    summary = progress.allDone
      ? t('home.today_summary_done', {count: totalSteps})
      : t('home.today_summary_left', {count: leftSteps, minutes: leftMinutes});
  }

  return (
    <View style={styles.card} testID="home-today-suggestion">
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <HomeSectionTitle title={t('home.today_label')} />
          {summary ? (
            <AppText style={styles.summary} testID="home-today-summary">
              {summary}
            </AppText>
          ) : null}
        </View>
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
              color={theme.colors.text.secondary}
              name="chevron_right"
              size={16}
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

      {hasSteps ? (
        // The summary line above already reads the progress out.
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.segmentRow}
          testID="home-today-progress"
        >
          {Array.from({length: totalSteps}).map((_, i) => (
            <View
              key={i}
              style={[
                styles.segment,
                i < doneSteps && styles.segmentDone,
                i === doneSteps && !progress.allDone && styles.segmentNext,
              ]}
            />
          ))}
        </View>
      ) : (
        <AppText style={styles.emptyText} testID="home-today-empty">
          {t('home.today_empty')}
        </AppText>
      )}

      {hasSteps && progress.allDone ? (
        <View style={styles.allDoneBox} testID="home-today-all-done">
          <AppText style={styles.allDone}>{t('home.today_all_done')}</AppText>
          <AppText style={styles.allDoneBody}>
            {t('home.today_all_done_body')}
          </AppText>
        </View>
      ) : null}

      {hasSteps && !progress.allDone ? (
        <View style={styles.stepList}>
          {progress.steps.map((step, index) => {
            const done = progress.doneIds.has(step.id);
            const isNext = step.id === nextId;
            const minutesText = t('home.today_step_minutes', {
              minutes: step.estimatedMinutes,
            });
            return (
              <Pressable
                key={step.id}
                accessibilityHint={t('home.today_start_hint')}
                accessibilityLabel={
                  done
                    ? t('home.today_step_done_a11y', {title: step.titleVi})
                    : t('home.today_start_a11y', {
                        title: step.titleVi,
                        minutes: step.estimatedMinutes,
                      })
                }
                accessibilityRole="button"
                onPress={() => onStartActivity(step)}
                style={({pressed}) => [
                  styles.stepRow,
                  isNext && styles.stepRowNext,
                  pressed && styles.pressed,
                ]}
                testID={`home-today-step-${step.id}`}
              >
                <View
                  style={[
                    styles.stepMark,
                    done && styles.stepMarkDone,
                    isNext && styles.stepMarkNext,
                  ]}
                >
                  <AppText
                    style={[
                      styles.stepMarkText,
                      (done || isNext) && styles.stepMarkTextStrong,
                    ]}
                  >
                    {done ? '✓' : String(index + 1)}
                  </AppText>
                </View>
                <View style={styles.stepText}>
                  {isNext ? (
                    <AppText style={styles.nextLabel}>
                      {t('home.today_step_current')}
                    </AppText>
                  ) : null}
                  <AppText
                    numberOfLines={2}
                    style={[styles.stepTitle, done && styles.stepTitleDone]}
                  >
                    {step.titleVi}
                  </AppText>
                  <AppText style={styles.stepMeta}>{minutesText}</AppText>
                </View>
                {isNext ? (
                  <View style={styles.startPill}>
                    <AppText style={styles.startPillText}>
                      {t('home.today_step_start')}
                    </AppText>
                  </View>
                ) : done ? null : (
                  <MaterialIcon
                    color={theme.colors.text.secondary}
                    name="chevron_right"
                    size={18}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Pressable
        accessibilityHint={t('home.today_details_hint')}
        accessibilityLabel={t('home.today_details_a11y')}
        accessibilityRole="button"
        onPress={onViewDetails}
        style={({pressed}) => [styles.detailsRow, pressed && styles.pressed]}
        testID="home-today-details"
      >
        <AppText style={styles.moreText}>
          {hasSteps && !progress.allDone && progress.hiddenStepCount > 0
            ? t('home.today_more_steps', {count: progress.hiddenStepCount})
            : ''}
        </AppText>
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
      borderRadius: 20,
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      ...getStickerEdge(4, theme.colors.ink),
    },
    headerRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
    },
    headerText: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    summary: {
      color: theme.colors.text.secondary,
      fontSize: 13,
      fontWeight: '700',
    },
    modeToggle: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceContainer,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 2,
      minHeight: 28,
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
      color: theme.colors.text.secondary,
      fontSize: 12,
      fontWeight: '700',
    },
    modeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    emptyText: {
      color: theme.colors.text.secondary,
      fontSize: 13,
    },
    segmentRow: {
      flexDirection: 'row',
      gap: 4,
    },
    segment: {
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: 999,
      flex: 1,
      height: 6,
    },
    segmentDone: {
      backgroundColor: theme.colors.accent,
    },
    segmentNext: {
      backgroundColor: theme.colors.accentSoft,
      borderColor: theme.colors.accent,
      borderWidth: 1,
    },
    stepList: {
      gap: 6,
    },
    stepRow: {
      alignItems: 'center',
      borderColor: theme.colors.surface,
      borderRadius: 14,
      borderWidth: 2,
      flexDirection: 'row',
      gap: 10,
      minHeight: 44,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    stepRowNext: {
      backgroundColor: theme.colors.accentSoft,
      borderColor: theme.colors.primary,
    },
    stepMark: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.surfaceHigh,
      borderRadius: 999,
      borderWidth: 2,
      height: 26,
      justifyContent: 'center',
      width: 26,
    },
    stepMarkDone: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    stepMarkNext: {
      borderColor: theme.colors.primary,
    },
    stepMarkText: {
      color: theme.colors.text.secondary,
      fontSize: 12,
      fontWeight: '700',
    },
    stepMarkTextStrong: {
      color: theme.colors.ink,
    },
    stepText: {
      flex: 1,
      minWidth: 0,
    },
    nextLabel: {
      color: theme.colors.primary,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    stepTitle: {
      color: theme.colors.text.primary,
      fontSize: 14,
      fontWeight: '700',
    },
    stepTitleDone: {
      color: theme.colors.text.secondary,
      fontWeight: '600',
      textDecorationLine: 'line-through',
    },
    stepMeta: {
      color: theme.colors.text.secondary,
      fontSize: 12,
      fontWeight: '600',
    },
    startPill: {
      backgroundColor: theme.colors.ink,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    startPillText: {
      color: theme.colors.surface,
      fontSize: 12,
      fontWeight: '800',
    },
    allDoneBox: {
      backgroundColor: theme.colors.accentSoft,
      borderRadius: 14,
      gap: 2,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    allDone: {
      color: theme.colors.text.primary,
      fontSize: 14,
      fontWeight: '800',
    },
    allDoneBody: {
      color: theme.colors.text.secondary,
      fontSize: 12,
      fontWeight: '600',
    },
    detailsRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
      minHeight: 36,
    },
    moreText: {
      color: theme.colors.text.secondary,
      flexShrink: 1,
      fontSize: 12,
      fontWeight: '700',
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
  });
}
