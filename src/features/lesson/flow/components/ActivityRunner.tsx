import React, {useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonBlock, LessonTask} from '@core/schemas/lesson';
import type {
  LessonAttemptOutcome,
  LessonSupportLevel,
} from '@core/schemas/sync';

import {blockAttempt, type EntryReport} from '../logic/activityOutcome';
import {type FlowActivity, type FlowItems} from '../logic/flowContent';
import {ActivityBody} from './ActivityBody';

export type ActivityRunnerProps = {
  block: LessonBlock;
  activity: FlowActivity;
  items: FlowItems;
  task: LessonTask | null;
  /** Outcome of the newest attempt on this block, if any. */
  latestOutcome: LessonAttemptOutcome | null;
  /**
   * PR 14 (decision H8): a speaking activity while speaking is off can be
   * skipped; nothing is recorded, so the practice waits for it.
   */
  speakingOff?: boolean;
  /** Saves the attempt; false when it could not be stored. */
  onFinished: (
    outcome: LessonAttemptOutcome,
    supportLevel: LessonSupportLevel,
    durationMs: number,
  ) => boolean;
};

/**
 * One activity block: its title and instructions, then the activity itself.
 * A finished run becomes one attempt (decision G3); a block already done
 * shows its last result with "Làm lại".
 */
export function ActivityRunner({
  block,
  activity,
  items,
  task,
  latestOutcome,
  speakingOff = false,
  onFinished,
}: ActivityRunnerProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [running, setRunning] = useState(latestOutcome === null);
  const [runKey, setRunKey] = useState(0);
  const [saveFailed, setSaveFailed] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const startedAt = useRef(Date.now());

  const start = () => {
    startedAt.current = Date.now();
    setSaveFailed(false);
    setRunKey(key => key + 1);
    setRunning(true);
  };

  const complete = (reports: EntryReport[]) => {
    const {outcome, supportLevel} = blockAttempt(reports);
    const saved = onFinished(
      outcome,
      supportLevel,
      Date.now() - startedAt.current,
    );
    setSaveFailed(!saved);
    setRunning(false);
  };

  return (
    <AppCard testID={`lesson-flow-activity-${block.id}`}>
      <View style={themedStyles.body}>
        <View style={themedStyles.header}>
          <Chip
            label={t(`lessonFlow.kind_${activity.kind}`)}
            tone="accentSoft"
          />
          {activity.titleVi ? (
            <AppText variant="h3">{activity.titleVi}</AppText>
          ) : null}
          {activity.instructionsVi ? (
            <AppText color="secondary">{activity.instructionsVi}</AppText>
          ) : null}
        </View>
        {speakingOff && running ? (
          <View style={themedStyles.result} testID="lesson-flow-speaking-off">
            <AppText color="secondary">
              {skipped
                ? t('lessonFlow.skip_speaking_hint')
                : t('lessonFlow.no_speaking_active')}
            </AppText>
            {skipped ? null : (
              <AppButton
                accessibilityHint={t('lessonFlow.skip_speaking_hint')}
                onPress={() => setSkipped(true)}
                testID="lesson-flow-skip-speaking"
                title={t('lessonFlow.skip_speaking')}
                variant="outline"
              />
            )}
          </View>
        ) : activity.content === null ? (
          <AppText color="secondary" testID="lesson-flow-activity-empty">
            {t('lessonFlow.activity_no_content')}
          </AppText>
        ) : running ? (
          <ActivityBody
            activity={activity}
            content={activity.content}
            items={items}
            key={runKey}
            onComplete={complete}
            task={task}
          />
        ) : (
          <View style={themedStyles.result}>
            {latestOutcome ? (
              <AppText testID="lesson-flow-activity-outcome" variant="label">
                {t(`lessonFlow.outcome_${latestOutcome}`)}
              </AppText>
            ) : null}
            {saveFailed ? (
              <AppText color="danger" testID="lesson-flow-activity-save-error">
                {t('lessonFlow.save_failed')}
              </AppText>
            ) : null}
            <AppButton
              accessibilityHint={t('lessonFlow.redo_hint')}
              onPress={start}
              testID="lesson-flow-activity-redo"
              title={t('lessonFlow.redo')}
              variant="outline"
            />
          </View>
        )}
      </View>
    </AppCard>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    body: {
      gap: theme.spacing.md,
    },
    header: {
      alignItems: 'flex-start',
      gap: theme.spacing.xs,
    },
    result: {
      gap: theme.spacing.sm,
    },
  });
}
