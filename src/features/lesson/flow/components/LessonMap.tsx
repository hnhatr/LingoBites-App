import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerFace} from '@ui/theme/hardShadow';

import type {LessonSnapshot} from '@core/schemas/lesson';

import {flowActivity} from '../logic/flowContent';
import {
  blocksOfStep,
  FLOW_STEPS,
  type FlowStep,
} from '../logic/practiceCompletion';

export type LessonMapProps = {
  snapshot: LessonSnapshot;
  /** The step "Bắt đầu học" opens (2 when step 1 is skipped). */
  nextStep: FlowStep;
  skippedSteps: ReadonlySet<number>;
  /** Current streak in days; nothing shown when 0 or unknown. */
  streakDays: number | null;
  onOpenStep: (step: FlowStep) => void;
};

const STEP_ICONS: Record<FlowStep, HandoffIconName> = {
  1: 'history_edu',
  2: 'hearing',
  3: 'mic',
  4: 'repeat',
  5: 'flag',
  6: 'emoji_events',
};

/**
 * Redesign: the lesson's goal and its six steps as a path, shown the first
 * time a lesson is opened (no attempt yet). Each stop opens its step.
 */
export function LessonMap({
  snapshot,
  nextStep,
  skippedSteps,
  streakDays,
  onOpenStep,
}: LessonMapProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const spec = snapshot.spec;
  const activityCount = useMemo(
    () => snapshot.blocks.filter(block => flowActivity(block) !== null).length,
    [snapshot],
  );
  const stepActivities = (step: number) =>
    blocksOfStep(snapshot, step).filter(block => flowActivity(block) !== null)
      .length;

  const describe = (step: FlowStep): string => {
    if (skippedSteps.has(step)) return t('lessonFlow.map_skipped');
    if (step === 6) return t('lessonFlow.map_result');
    const count = stepActivities(step);
    return count > 0
      ? t('lessonFlow.map_activities', {count})
      : t('lessonFlow.map_read');
  };

  return (
    <View style={themedStyles.container} testID="lesson-flow-map">
      <View style={themedStyles.goal}>
        <AppText style={themedStyles.goalLabel} variant="caption">
          {t('lessonFlow.map_goal_label')}
        </AppText>
        <AppText style={themedStyles.goalTitle} variant="h2">
          {snapshot.title}
        </AppText>
        {spec && spec.can_do.length > 0 ? (
          <AppText style={themedStyles.goalText} testID="lesson-flow-map-goal">
            {t('lessonFlow.map_can_do', {goal: spec.can_do.join(' · ')})}
          </AppText>
        ) : null}
        <View style={themedStyles.pills}>
          {spec?.estimated_minutes ? (
            <View style={themedStyles.pill}>
              <MaterialIcon
                color={theme.colors.text.inverse}
                name="schedule"
                size={16}
              />
              <AppText style={themedStyles.pillText} variant="caption">
                {t('lessonFlow.map_minutes', {
                  count: spec.estimated_minutes,
                })}
              </AppText>
            </View>
          ) : null}
          {activityCount > 0 ? (
            <View style={themedStyles.pill}>
              <MaterialIcon
                color={theme.colors.text.inverse}
                name="bolt"
                size={16}
              />
              <AppText style={themedStyles.pillText} variant="caption">
                {t('lessonFlow.map_activities', {count: activityCount})}
              </AppText>
            </View>
          ) : null}
          {streakDays ? (
            <View
              style={[themedStyles.pill, themedStyles.streak]}
              testID="lesson-flow-map-streak"
            >
              <MaterialIcon
                color={theme.colors.onTertiaryContainer}
                name="local_fire_department"
                size={16}
              />
              <AppText style={themedStyles.streakText} variant="caption">
                {t('lessonFlow.map_streak', {count: streakDays})}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>

      <View style={themedStyles.path}>
        {FLOW_STEPS.map((step, index) => {
          const skipped = skippedSteps.has(step);
          const next = step === nextStep;
          const label = t(`lessonFlow.step_${step}`);
          return (
            <View key={step}>
              {index > 0 ? (
                <View style={themedStyles.connector}>
                  <View style={themedStyles.dot} />
                  <View style={themedStyles.dot} />
                </View>
              ) : null}
              <View style={offsetStyles[index]}>
                <Pressable
                  accessibilityHint={t('lessonFlow.step_chip_hint')}
                  accessibilityLabel={`${label}. ${describe(step)}`}
                  accessibilityRole="button"
                  accessibilityState={{disabled: skipped}}
                  disabled={skipped}
                  onPress={() => onOpenStep(step)}
                  style={themedStyles.stop}
                  testID={`lesson-flow-map-step-${step}`}
                >
                  <View
                    style={[
                      themedStyles.node,
                      next
                        ? themedStyles.nodeNext
                        : skipped
                        ? themedStyles.nodeSkipped
                        : themedStyles.nodeUpcoming,
                    ]}
                  >
                    <MaterialIcon
                      color={
                        next
                          ? theme.colors.accentInk
                          : skipped
                          ? theme.colors.primary
                          : theme.colors.text.muted
                      }
                      name={skipped ? 'check_circle' : STEP_ICONS[step]}
                      size={next ? 30 : 24}
                    />
                  </View>
                  <View style={themedStyles.stopText}>
                    {next ? (
                      <View style={themedStyles.nextTag}>
                        <AppText
                          style={themedStyles.nextTagText}
                          variant="caption"
                        >
                          {t('lessonFlow.map_next')}
                        </AppText>
                      </View>
                    ) : null}
                    <AppText
                      color={next ? 'primary' : 'secondary'}
                      variant={next ? 'title' : 'label'}
                    >
                      {label}
                    </AppText>
                    <AppText color="muted" variant="caption">
                      {describe(step)}
                    </AppText>
                  </View>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  const {colors} = theme;
  return StyleSheet.create({
    connector: {
      gap: theme.spacing.xs,
      paddingLeft: '30%',
      paddingVertical: theme.spacing.xs,
    },
    container: {
      gap: theme.spacing.xl,
    },
    dot: {
      backgroundColor: colors.outlineVariant,
      borderRadius: theme.radius.pill,
      height: 6,
      width: 6,
    },
    goal: {
      backgroundColor: colors.primary,
      borderRadius: theme.radius.xl,
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
      ...getStickerFace(theme, 4),
    },
    goalLabel: {
      color: colors.text.inverse,
      fontWeight: theme.typography.weight.bold,
      letterSpacing: 0.8,
      opacity: 0.85,
      textTransform: 'uppercase',
    },
    goalText: {
      color: colors.text.inverse,
    },
    goalTitle: {
      color: colors.text.inverse,
    },
    nextTag: {
      alignSelf: 'flex-start',
      backgroundColor: colors.ink,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
    },
    nextTagText: {
      color: colors.tertiaryFixed,
      fontWeight: theme.typography.weight.bold,
    },
    node: {
      alignItems: 'center',
      borderRadius: theme.radius.pill,
      height: 56,
      justifyContent: 'center',
      width: 56,
    },
    nodeNext: {
      backgroundColor: colors.accent,
      height: 68,
      width: 68,
      ...getStickerFace(theme, 4),
    },
    nodeSkipped: {
      backgroundColor: colors.accentSoft,
    },
    nodeUpcoming: {
      backgroundColor: colors.surface,
      borderColor: colors.outlineVariant,
      borderWidth: 2,
    },
    path: {
      paddingBottom: theme.spacing.lg,
    },
    pill: {
      alignItems: 'center',
      backgroundColor: colors.overlayLight,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    pillText: {
      color: colors.text.inverse,
      fontWeight: theme.typography.weight.medium,
    },
    pills: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    stop: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      flexDirection: 'row',
      gap: theme.spacing.md,
      minHeight: 44,
    },
    stopText: {
      gap: 2,
      maxWidth: 190,
    },
    streak: {
      backgroundColor: colors.tertiaryFixed,
    },
    streakText: {
      color: colors.onTertiaryContainer,
      fontWeight: theme.typography.weight.bold,
    },
  });
}

/** Zig-zag offsets of the path's stops, as a share of the free width. */
const offsets = StyleSheet.create({
  stop1: {paddingLeft: '0%'},
  stop2: {paddingLeft: '38%'},
  stop3: {paddingLeft: '8%'},
  stop4: {paddingLeft: '42%'},
  stop5: {paddingLeft: '12%'},
  stop6: {paddingLeft: '36%'},
});
const offsetStyles = [
  offsets.stop1,
  offsets.stop2,
  offsets.stop3,
  offsets.stop4,
  offsets.stop5,
  offsets.stop6,
];
