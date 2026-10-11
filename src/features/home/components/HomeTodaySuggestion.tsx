/**
 * HomeTodaySuggestion — "Kế hoạch hôm nay" checklist under the hero (F12).
 *
 * Shows the day's study plan as steps the learner ticks off:
 *   [Kế hoạch hôm nay ................ 🎯 20 phút ▾]
 *   [✓ Step 1 ........................... 5m]
 *   [○ Step 2  (Tiếp theo) .............. 8m]
 *   [○ Step 3 ........................... 7m]
 *   [▓▓▓▓░░░░ 1/3 bước ........ Xem chi tiết]
 *   [footer: weekly goal row]
 *
 * The mode button opens the 5/20/45-minute chips in place; picking one closes
 * them. Progress counts steps, not minutes: a plan can be shorter than the
 * chosen mode when there is not enough to study. The hero owns the primary
 * action; the step it points at carries the "Tiếp theo" tag here so both
 * cards read as one flow. Open steps stay tappable as a secondary path.
 * "Xem chi tiết" opens the full `Today` route with the selected mode.
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
  /** Plan step the hero is pointing at, tagged "Tiếp theo". */
  currentStepId: string | null;
  onModeChange: (mode: TodayMode) => void;
  onStartActivity: (activity: StudyActivityItem) => void;
  onViewDetails: () => void;
  /** Rendered under the plan, e.g. the weekly goal row. */
  footer?: ReactNode;
};

/** Prefix the Today engine puts on a `continue_lesson` step title. */
const CONTINUE_PREFIX = 'Học tiếp: ';

/**
 * Home shows the lesson name alone: the hero already says "Học tiếp", and it
 * can point at another started lesson than the plan's step.
 */
function stepTitle(step: StudyActivityItem): string {
  return step.type === 'continue_lesson' &&
    step.titleVi.startsWith(CONTINUE_PREFIX)
    ? step.titleVi.slice(CONTINUE_PREFIX.length)
    : step.titleVi;
}

export function HomeTodaySuggestion({
  mode,
  progress,
  currentStepId,
  onModeChange,
  onStartActivity,
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
          style={({pressed}) => [
            styles.modeToggle,
            pressed && styles.stepRowPressed,
          ]}
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

      {hasSteps ? (
        <View style={styles.stepList}>
          {progress.steps.map(step => {
            const done = progress.doneIds.has(step.id);
            const current = !done && step.id === currentStepId;
            const row = (
              <>
                {done ? (
                  <View style={styles.checkSlot}>
                    <MaterialIcon
                      color={theme.colors.secondary}
                      name="check_circle"
                      size={22}
                    />
                  </View>
                ) : (
                  <View style={styles.checkSlot}>
                    <View
                      style={[styles.openDot, current && styles.openDotCurrent]}
                    />
                  </View>
                )}
                <View style={styles.stepCopy}>
                  <AppText
                    numberOfLines={1}
                    style={[styles.stepTitle, done && styles.stepTitleDone]}
                  >
                    {stepTitle(step)}
                  </AppText>
                  {current ? (
                    <AppText style={styles.currentTag}>
                      {t('home.today_step_current')}
                    </AppText>
                  ) : null}
                </View>
                <AppText style={styles.stepMinutes}>
                  ~{step.estimatedMinutes}m
                </AppText>
              </>
            );
            if (done) {
              return (
                <View
                  key={step.id}
                  accessibilityLabel={t('home.today_step_done_a11y', {
                    title: stepTitle(step),
                  })}
                  accessible
                  style={styles.stepRow}
                  testID={`home-today-step-${step.id}`}
                >
                  {row}
                </View>
              );
            }
            return (
              <Pressable
                key={step.id}
                accessibilityHint={t('home.today_start_hint')}
                accessibilityLabel={t('home.today_start_a11y', {
                  title: stepTitle(step),
                  minutes: step.estimatedMinutes,
                })}
                accessibilityRole="button"
                onPress={() => onStartActivity(step)}
                style={({pressed}) => [
                  styles.stepRow,
                  current && styles.stepRowCurrent,
                  pressed && styles.stepRowPressed,
                ]}
                testID={`home-today-step-${step.id}`}
              >
                {row}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <AppText style={styles.emptyText} testID="home-today-empty">
          {t('home.today_empty')}
        </AppText>
      )}

      <View style={styles.footer}>
        {hasSteps ? (
          progress.allDone ? (
            <AppText style={styles.allDone} testID="home-today-all-done">
              {t('home.today_all_done')}
            </AppText>
          ) : (
            <View
              accessibilityLabel={t('home.today_progress_a11y', {
                done: doneSteps,
                total: totalSteps,
              })}
              accessible
              style={styles.progressWrap}
              testID="home-today-progress"
            >
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
    stepList: {
      gap: 6,
    },
    stepRow: {
      alignItems: 'center',
      borderRadius: 14,
      flexDirection: 'row',
      gap: 10,
      minHeight: 44,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    stepRowCurrent: {
      backgroundColor: theme.colors.accentSoft,
    },
    stepRowPressed: {
      opacity: theme.states.pressedOpacity,
    },
    checkSlot: {
      alignItems: 'center',
      height: 22,
      justifyContent: 'center',
      width: 22,
    },
    openDot: {
      borderColor: theme.colors.outline,
      borderRadius: 9,
      borderWidth: 2,
      height: 18,
      width: 18,
    },
    openDotCurrent: {
      borderColor: theme.colors.primary,
    },
    stepCopy: {
      flex: 1,
      minWidth: 0,
    },
    stepTitle: {
      color: theme.colors.text.primary,
      fontSize: 14,
      fontWeight: '700',
    },
    stepTitleDone: {
      color: theme.colors.text.secondary,
      textDecorationLine: 'line-through',
    },
    currentTag: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    stepMinutes: {
      color: theme.colors.text.secondary,
      fontSize: 12,
      fontWeight: '600',
    },
    emptyText: {
      color: theme.colors.text.secondary,
      fontSize: 13,
    },
    footer: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
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
