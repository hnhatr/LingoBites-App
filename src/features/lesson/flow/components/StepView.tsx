import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonBlock, LessonSnapshot} from '@core/schemas/lesson';
import type {
  LessonAttemptOutcome,
  LessonSupportLevel,
} from '@core/schemas/sync';
import type {LessonActivityAttemptRow} from '@core/sync/activityAttempts';

import {CanonicalBlockView} from '../../player/components/CanonicalBlockView';
import {flowActivity, type FlowItems} from '../logic/flowContent';
import {blocksOfStep} from '../logic/practiceCompletion';
import {ActivityRunner} from './ActivityRunner';

export type StepViewProps = {
  snapshot: LessonSnapshot;
  step: number;
  items: FlowItems;
  attempts: readonly LessonActivityAttemptRow[];
  onSpeakText: (text: string) => void;
  onFinished: (
    block: LessonBlock,
    outcome: LessonAttemptOutcome,
    supportLevel: LessonSupportLevel,
    durationMs: number,
  ) => boolean;
};

/** Newest outcome per block (attempts are listed newest first). */
export function latestOutcomes(
  attempts: readonly LessonActivityAttemptRow[],
): Map<string, LessonAttemptOutcome> {
  const latest = new Map<string, LessonAttemptOutcome>();
  for (const attempt of attempts) {
    if (!latest.has(attempt.blockId)) {
      latest.set(attempt.blockId, attempt.outcome);
    }
  }
  return latest;
}

/** The blocks of one step 1–5: reading blocks as they are, activities live. */
export function StepView({
  snapshot,
  step,
  items,
  attempts,
  onSpeakText,
  onFinished,
}: StepViewProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const blocks = useMemo(() => blocksOfStep(snapshot, step), [snapshot, step]);
  const latest = useMemo(() => latestOutcomes(attempts), [attempts]);

  if (blocks.length === 0) {
    return (
      <AppText color="secondary" testID="lesson-flow-step-empty">
        {t('lessonFlow.step_empty')}
      </AppText>
    );
  }
  return (
    <View style={themedStyles.container}>
      {blocks.map(block => {
        const activity = flowActivity(block);
        return activity ? (
          <ActivityRunner
            activity={activity}
            block={block}
            items={items}
            key={block.id}
            latestOutcome={latest.get(block.id) ?? null}
            onFinished={(outcome, supportLevel, durationMs) =>
              onFinished(block, outcome, supportLevel, durationMs)
            }
          />
        ) : (
          <CanonicalBlockView
            block={block}
            items={items}
            key={block.id}
            onSpeakText={onSpeakText}
          />
        );
      })}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.lg,
    },
  });
}
