import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonSnapshot} from '@core/schemas/lesson';
import type {LessonActivityAttemptRow} from '@core/sync/activityAttempts';

import {flowActivity} from '../logic/flowContent';
import type {FlowStep} from '../logic/practiceCompletion';
import {latestOutcomes} from './StepView';

export type StepResultProps = {
  snapshot: LessonSnapshot;
  attempts: readonly LessonActivityAttemptRow[];
  practiceDone: boolean;
  practiceRemaining: number;
  onOpenStep: (step: FlowStep) => void;
  onClose: () => void;
};

/**
 * Step 6: the newest result of every activity of steps 2–5, whether the
 * practice part is done, and a way back to what is not passed yet.
 */
export function StepResult({
  snapshot,
  attempts,
  practiceDone,
  practiceRemaining,
  onOpenStep,
  onClose,
}: StepResultProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const latest = useMemo(() => latestOutcomes(attempts), [attempts]);
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

  return (
    <View style={themedStyles.container} testID="lesson-flow-result">
      <AppCard>
        <AppText testID="lesson-flow-practice-status" variant="h3">
          {practiceDone
            ? t('lessonFlow.practice_done')
            : t('lessonFlow.practice_remaining', {count: practiceRemaining})}
        </AppText>
      </AppCard>
      {rows.map(({block, activity}) => {
        const outcome = latest.get(block.id);
        return (
          <View
            key={block.id}
            style={themedStyles.row}
            testID={`lesson-flow-result-${block.id}`}
          >
            <AppText style={themedStyles.flex} variant="body">
              {block.step}.{' '}
              {activity.titleVi || t(`lessonFlow.kind_${activity.kind}`)}
            </AppText>
            <AppText color="secondary" variant="label">
              {outcome
                ? t(`lessonFlow.outcome_${outcome}`)
                : t('lessonFlow.outcome_none')}
            </AppText>
          </View>
        );
      })}
      {firstOpen?.block.step != null ? (
        <AppButton
          accessibilityHint={t('lessonFlow.open_unfinished_hint')}
          onPress={() => onOpenStep(firstOpen.block.step as FlowStep)}
          testID="lesson-flow-open-unfinished"
          title={t('lessonFlow.open_unfinished')}
          variant="secondary"
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

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.md,
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
