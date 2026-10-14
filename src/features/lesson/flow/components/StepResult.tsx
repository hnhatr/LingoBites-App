import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
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
        <View pointerEvents="none" style={themedStyles.confetti}>
          <View style={[themedStyles.bit, themedStyles.bitA]} />
          <View style={[themedStyles.bit, themedStyles.bitB]} />
          <View style={[themedStyles.bit, themedStyles.bitC]} />
          <View style={[themedStyles.bit, themedStyles.bitD]} />
        </View>
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
          variant="h3"
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
          <View accessible style={[themedStyles.stat, themedStyles.statGold]}>
            <AppText variant="h1">{`${passedCount}/${rows.length}`}</AppText>
            <AppText variant="caption">
              {t('lessonFlow.result_stat_passed')}
            </AppText>
          </View>
          <View accessible style={[themedStyles.stat, themedStyles.statPlain]}>
            <AppText variant="h1">{String(failedCount)}</AppText>
            <AppText variant="caption">
              {t('lessonFlow.result_stat_review')}
            </AppText>
          </View>
          {streakDays ? (
            <View accessible style={[themedStyles.stat, themedStyles.statPink]}>
              <AppText variant="h1">{String(streakDays)}</AppText>
              <AppText variant="caption">
                {t('lessonFlow.result_stat_streak')}
              </AppText>
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
    bit: {
      position: 'absolute',
    },
    bitA: {
      backgroundColor: theme.colors.tertiaryFixed,
      height: 12,
      left: 24,
      top: 22,
      transform: [{rotate: '20deg'}],
      width: 12,
    },
    bitB: {
      backgroundColor: theme.colors.secondaryContainer,
      borderRadius: 6,
      height: 10,
      right: 32,
      top: 40,
      width: 10,
    },
    bitC: {
      backgroundColor: theme.colors.accent,
      borderRadius: 4,
      height: 7,
      right: 64,
      top: 14,
      transform: [{rotate: '-30deg'}],
      width: 16,
    },
    bitD: {
      backgroundColor: theme.colors.accentSoft,
      borderRadius: 5,
      bottom: 28,
      height: 9,
      left: 40,
      width: 9,
    },
    confetti: {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    stat: {
      alignItems: 'center',
      borderRadius: theme.radius.lg,
      flexBasis: 96,
      flexGrow: 1,
      gap: 2,
      paddingVertical: theme.spacing.md,
      ...getStickerFace(theme, 4),
    },
    statGold: {
      backgroundColor: theme.colors.tertiaryFixed,
    },
    statPink: {
      backgroundColor: theme.colors.secondarySoft,
    },
    statPlain: {
      backgroundColor: theme.colors.surface,
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
