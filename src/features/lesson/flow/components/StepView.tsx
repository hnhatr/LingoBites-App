import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonBlock, LessonSnapshot} from '@core/schemas/lesson';
import type {
  LessonAttemptOutcome,
  LessonSupportLevel,
} from '@core/schemas/sync';
import type {LessonActivityAttemptRow} from '@core/sync/activityAttempts';

import {CanonicalBlockView} from '../../player/components/CanonicalBlockView';
import {studyCardStyle} from '../../player/components/StudyControls';
import {flowActivity, type FlowItems, flowTask} from '../logic/flowContent';
import {isIndependentBlock} from '../logic/independent';
import {isSpeakingActivity} from '../logic/noSpeaking';
import {blocksOfStep} from '../logic/practiceCompletion';
import {ActivityRunner} from './ActivityRunner';
import {useFlowFooter} from './FlowFooter';
import {type GradedAttempt, IndependentTaskView} from './IndependentTaskView';
import {ListenCardDeck} from './ListenCardDeck';

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
    graded?: GradedAttempt,
  ) => boolean;
  /** PR 14: open a practice step from a step-5 result. */
  onOpenStep?: (step: number) => void;
  /** PR 14 (decision H8): speaking is off for now. */
  speakingOff?: boolean;
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

/**
 * The blocks of one step 1–5: reading blocks as they are, activities live.
 * Redesign: one activity at a time, opening on the first without a result;
 * "Hoạt động tiếp" moves on once it has one.
 */
export function StepView({
  snapshot,
  step,
  items,
  attempts,
  onSpeakText,
  onFinished,
  onOpenStep,
  speakingOff = false,
}: StepViewProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const blocks = useMemo(() => blocksOfStep(snapshot, step), [snapshot, step]);
  const latest = useMemo(() => latestOutcomes(attempts), [attempts]);
  const activityIds = useMemo(
    () => blocks.filter(block => flowActivity(block) !== null).map(b => b.id),
    [blocks],
  );
  const [focus, setFocus] = useState(() => {
    const open = activityIds.findIndex(id => !latest.has(id));
    return open < 0 ? 0 : open;
  });
  const focusedId = activityIds[focus];
  useFlowFooter(
    focusedId && latest.has(focusedId) && focus + 1 < activityIds.length
      ? {
          title: t('lessonFlow.next_activity'),
          hint: t('lessonFlow.next_activity_hint'),
          testID: 'lesson-flow-next-activity',
          onPress: () => setFocus(current => current + 1),
        }
      : null,
    1,
  );

  if (blocks.length === 0) {
    return (
      <View style={themedStyles.empty} testID="lesson-flow-step-empty">
        <View style={themedStyles.emptyIcon}>
          <MaterialIcon
            color={theme.colors.onTertiaryContainer}
            name="auto_awesome"
            size={30}
          />
        </View>
        <AppText style={themedStyles.emptyTitle} variant="h3">
          {t('lessonFlow.step_empty_title')}
        </AppText>
        <AppText color="secondary" style={themedStyles.center}>
          {t('lessonFlow.step_empty')}
        </AppText>
      </View>
    );
  }
  return (
    <View style={themedStyles.container}>
      {activityIds.length > 1 ? (
        <View style={themedStyles.tabs} testID="lesson-flow-activity-tabs">
          {activityIds.map((id, position) => (
            <Chip
              accessibilityHint={t('lessonFlow.open_activity_hint')}
              key={id}
              label={t('lessonFlow.activity_tab', {
                current: position + 1,
                total: activityIds.length,
              })}
              onPress={() => setFocus(position)}
              selected={position === focus}
              testID={`lesson-flow-activity-tab-${position + 1}`}
              tone={latest.has(id) ? 'accentSoft' : 'default'}
            />
          ))}
        </View>
      ) : null}
      {blocks.map(block => {
        const activity = flowActivity(block);
        if (activity && block.id !== focusedId) return null;
        const task = activity ? flowTask(snapshot, activity.taskId) : null;
        if (
          activity &&
          task &&
          task.response_mode !== 'choose' &&
          isIndependentBlock(block, task)
        ) {
          return (
            <IndependentTaskView
              activity={activity}
              block={block}
              items={items}
              key={block.id}
              latestOutcome={latest.get(block.id) ?? null}
              onFinished={(outcome, supportLevel, durationMs, graded) =>
                onFinished(block, outcome, supportLevel, durationMs, graded)
              }
              onPracticeRelated={onOpenStep ? () => onOpenStep(3) : undefined}
              snapshot={snapshot}
              task={task}
              writeInstead={speakingOff && task.response_mode === 'speak'}
            />
          );
        }
        if (!activity && step === 2 && block.type === 'item_cards') {
          return (
            <ListenCardDeck
              block={block}
              items={items}
              key={block.id}
              onDone={onOpenStep ? () => onOpenStep(step + 1) : undefined}
            />
          );
        }
        return activity ? (
          <ActivityRunner
            activity={activity}
            block={block}
            items={items}
            key={block.id}
            latestOutcome={latest.get(block.id) ?? null}
            speakingOff={speakingOff && isSpeakingActivity(activity.kind)}
            task={task}
            youtubeVideoId={snapshot.youtube?.video_id ?? null}
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
    center: {
      textAlign: 'center',
    },
    container: {
      gap: theme.spacing.lg,
    },
    empty: {
      ...studyCardStyle(theme),
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.xl,
    },
    emptyIcon: {
      alignItems: 'center',
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: 22,
      height: 64,
      justifyContent: 'center',
      width: 64,
    },
    emptyTitle: {
      textAlign: 'center',
    },
    tabs: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
  });
}
