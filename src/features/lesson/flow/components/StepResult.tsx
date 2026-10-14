import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {StatTile} from '@ui/components/StatTile';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerFace} from '@ui/theme/hardShadow';

import type {LessonSnapshot} from '@core/schemas/lesson';
import type {LessonActivityAttemptRow} from '@core/sync/activityAttempts';

import {flowActivity} from '../logic/flowContent';
import {useLessonOutcome} from '../logic/lessonOutcome';
import type {FlowStep} from '../logic/practiceCompletion';
import {latestOutcomes} from './StepView';

export type StepResultProps = {
  snapshot: LessonSnapshot;
  attempts: readonly LessonActivityAttemptRow[];
  practiceDone: boolean;
  practiceRemaining: number;
  onOpenStep: (step: FlowStep) => void;
  onClose: () => void;
  /** A unit lesson: open the unit's next lesson in place of this one. */
  onNextLesson?: () => void;
  /** A unit lesson: close the lesson and show its unit's lessons. */
  onBackToUnit?: () => void;
  /** Current streak in days, shown as a stat when known and above 0. */
  streakDays?: number | null;
};

/**
 * Step 6: the newest result of every activity of steps 2–5, whether the
 * practice part is done, whether the lesson is passed (PR 16), and a way
 * back to what is not passed yet.
 */
export function StepResult({
  snapshot,
  attempts,
  practiceDone,
  practiceRemaining,
  onOpenStep,
  onClose,
  onNextLesson,
  onBackToUnit,
  streakDays,
}: StepResultProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const latest = useMemo(() => latestOutcomes(attempts), [attempts]);
  /** Support level of the newest attempt per block (newest first). */
  const support = useMemo(() => {
    const map = new Map<string, string>();
    for (const attempt of attempts) {
      if (!map.has(attempt.blockId)) {
        map.set(attempt.blockId, attempt.supportLevel);
      }
    }
    return map;
  }, [attempts]);
  const rows = useMemo(
    () =>
      snapshot.blocks
        .filter(
          block => block.step != null && block.step >= 2 && block.step <= 5,
        )
        .sort(
          (a, b) => (a.step ?? 0) - (b.step ?? 0) || a.position - b.position,
        )
        .flatMap(block => {
          const activity = flowActivity(block);
          return activity ? [{block, activity}] : [];
        }),
    [snapshot],
  );
  const firstOpen = rows.find(({block}) => {
    const outcome = latest.get(block.id);
    return outcome === undefined || outcome === 'fail';
  });
  const lessonOutcome = useLessonOutcome(snapshot, attempts);
  const hasIndependent = rows.some(({block}) => block.step === 5);
  const passedCount = rows.filter(({block}) =>
    isPass(latest.get(block.id)),
  ).length;
  const failedCount = rows.filter(
    ({block}) => latest.get(block.id) === 'fail',
  ).length;
  const heroKey =
    lessonOutcome.label === 'passed'
      ? 'lessonFlow.result_hero_passed'
      : practiceDone
      ? 'lessonFlow.result_hero_practice_done'
      : 'lessonFlow.result_hero_in_progress';

  return (
    <View style={themedStyles.container} testID="lesson-flow-result">
      <View style={themedStyles.hero} testID="lesson-flow-result-hero">
        <View style={themedStyles.badge}>
          <MaterialIcon
            color={theme.colors.onTertiaryContainer}
            name={lessonOutcome.label === 'passed' ? 'emoji_events' : 'bolt'}
            size={44}
          />
        </View>
        <AppText
          color="inverse"
          style={themedStyles.center}
          testID="lesson-flow-result-title"
          variant="h2"
        >
          {t(heroKey)}
        </AppText>
        <AppText
          color="inverse"
          style={themedStyles.center}
          testID="lesson-flow-practice-status"
          variant="title"
        >
          {practiceDone
            ? t('lessonFlow.practice_done')
            : t('lessonFlow.practice_remaining', {count: practiceRemaining})}
        </AppText>
        {lessonOutcome.label === 'in_progress' ? null : (
          <AppText
            color="inverse"
            style={themedStyles.center}
            testID="lesson-flow-lesson-outcome"
            variant="body"
          >
            {t(`lessonFlow.lesson_outcome_${lessonOutcome.label}`)}
          </AppText>
        )}
        {lessonOutcome.label === 'passed' && !lessonOutcome.confirmed ? (
          <AppText
            color="inverse"
            style={themedStyles.center}
            testID="lesson-flow-lesson-outcome-unconfirmed"
            variant="label"
          >
            {t('lessonFlow.lesson_outcome_unconfirmed')}
          </AppText>
        ) : null}
      </View>
      {rows.length > 0 ? (
        <View style={themedStyles.stats} testID="lesson-flow-result-stats">
          <View style={themedStyles.stat}>
            <StatTile
              icon="check_circle"
              label={t('lessonFlow.result_stat_passed')}
              value={`${passedCount}/${rows.length}`}
            />
          </View>
          <View style={themedStyles.stat}>
            <StatTile
              icon="refresh"
              label={t('lessonFlow.result_stat_review')}
              tone="gold"
              value={failedCount}
            />
          </View>
          {streakDays ? (
            <View style={themedStyles.stat}>
              <StatTile
                icon="local_fire_department"
                label={t('lessonFlow.result_stat_streak')}
                tone="coral"
                value={streakDays}
              />
            </View>
          ) : null}
        </View>
      ) : null}
      {(
        [
          ['practice', rows.filter(({block}) => (block.step ?? 0) < 5)],
          ['independent', rows.filter(({block}) => block.step === 5)],
        ] as const
      ).map(([part, partRows]) =>
        partRows.length === 0 ? null : (
          <View
            key={part}
            style={themedStyles.container}
            testID={`lesson-flow-result-${part}`}
          >
            <AppText variant="h3">{t(`lessonFlow.result_${part}`)}</AppText>
            {partRows.map(({block, activity}) => {
              const outcome = latest.get(block.id);
              const level = support.get(block.id);
              return (
                <View
                  key={block.id}
                  style={themedStyles.row}
                  testID={`lesson-flow-result-${block.id}`}
                >
                  <MaterialIcon
                    color={
                      isPass(outcome)
                        ? theme.colors.primary
                        : outcome === 'fail'
                        ? theme.colors.secondary
                        : theme.colors.text.muted
                    }
                    name={rowIcon(outcome)}
                    size={22}
                  />
                  <AppText style={themedStyles.flex} variant="body">
                    {block.step}.{' '}
                    {activity.titleVi || t(`lessonFlow.kind_${activity.kind}`)}
                  </AppText>
                  <AppText color="secondary" variant="label">
                    {outcome
                      ? t(`lessonFlow.outcome_${outcome}`)
                      : t('lessonFlow.outcome_none')}
                    {level && level !== 'none'
                      ? ` · ${t(`lessonFlow.support_${level}`)}`
                      : ''}
                  </AppText>
                </View>
              );
            })}
          </View>
        ),
      )}
      {firstOpen?.block.step != null ? (
        <AppButton
          accessibilityHint={t('lessonFlow.open_unfinished_hint')}
          onPress={() => onOpenStep(firstOpen.block.step as FlowStep)}
          testID="lesson-flow-open-unfinished"
          title={t('lessonFlow.open_unfinished')}
          variant="secondary"
        />
      ) : null}
      {lessonOutcome.label === 'practice_done' &&
      hasIndependent &&
      firstOpen?.block.step !== 5 ? (
        <AppButton
          accessibilityHint={t('lessonFlow.redo_independent_hint')}
          onPress={() => onOpenStep(5)}
          testID="lesson-flow-redo-independent"
          title={t('lessonFlow.redo_independent')}
          variant="secondary"
        />
      ) : null}
      {onNextLesson ? (
        <AppButton
          accessibilityHint={t('lessonFlow.next_lesson_hint')}
          iconRight="chevron_right"
          onPress={onNextLesson}
          testID="lesson-flow-next-lesson"
          title={t('lessonFlow.next_lesson')}
        />
      ) : null}
      {onBackToUnit ? (
        <AppButton
          accessibilityHint={t('lessonFlow.back_to_unit_hint')}
          onPress={onBackToUnit}
          testID="lesson-flow-back-to-unit"
          title={t('lessonFlow.back_to_unit')}
          variant="outline"
        />
      ) : null}
      <AppButton
        accessibilityHint={t('lessonFlow.back_to_lesson_hint')}
        onPress={onClose}
        testID="lesson-flow-back-to-lesson"
        title={t('lessonFlow.back_to_lesson')}
        variant="outline"
      />
    </View>
  );
}

function isPass(outcome: string | undefined): boolean {
  return outcome === 'pass_independent' || outcome === 'pass_with_support';
}

function rowIcon(outcome: string | undefined): HandoffIconName {
  if (isPass(outcome)) return 'check_circle';
  if (outcome === 'fail') return 'refresh';
  if (outcome === 'pending') return 'schedule';
  return 'circle';
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    badge: {
      alignItems: 'center',
      backgroundColor: theme.colors.tertiaryFixed,
      borderRadius: theme.radius.pill,
      height: 84,
      justifyContent: 'center',
      width: 84,
      ...getStickerFace(theme, 4),
    },
    center: {
      textAlign: 'center',
    },
    container: {
      gap: theme.spacing.md,
    },
    hero: {
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.xl,
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
      ...getStickerFace(theme, 4),
    },
    stat: {
      flexBasis: 140,
      flexGrow: 1,
    },
    stats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    flex: {
      flex: 1,
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
  });
}
