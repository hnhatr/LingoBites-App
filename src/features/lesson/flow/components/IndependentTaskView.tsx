import React, {useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {speak} from '@features/audio';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {IconButton} from '@ui/components/IconButton';
import {TextField} from '@ui/components/TextField';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {RolePlayContent} from '@core/schemas/activityContent';
import type {
  LessonBlock,
  LessonSnapshot,
  LessonTask,
} from '@core/schemas/lesson';
import type {
  LessonAttemptOutcome,
  LessonSupportLevel,
} from '@core/schemas/sync';

import type {FlowActivity, FlowItems} from '../logic/flowContent';
import {
  criteriaOutcome,
  type Criterion,
  referenceSentences,
  situationOf,
} from '../logic/independent';
import {CriteriaChecklist} from './CriteriaChecklist';
import {RecorderControls} from './RecorderControls';

export type IndependentTaskViewProps = {
  block: LessonBlock;
  activity: FlowActivity;
  task: LessonTask;
  snapshot: LessonSnapshot;
  items: FlowItems;
  latestOutcome: LessonAttemptOutcome | null;
  onFinished: (
    outcome: LessonAttemptOutcome,
    supportLevel: LessonSupportLevel,
    durationMs: number,
  ) => boolean;
};

type Phase = 'answer' | 'judge' | 'done';

/**
 * Step 5, independent use (decisions G4–G5): the task's situation, no model
 * and no hints. The learner says (records) or writes their answer, then
 * ticks the task's criteria; the required ones decide the result. Only then
 * can the reference sentences be seen, which changes nothing recorded.
 */
export function IndependentTaskView({
  block,
  activity,
  task,
  snapshot,
  items,
  latestOutcome,
  onFinished,
}: IndependentTaskViewProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [phase, setPhase] = useState<Phase>(latestOutcome ? 'done' : 'answer');
  const [written, setWritten] = useState('');
  const [ticked, setTicked] = useState<ReadonlySet<Criterion>>(new Set());
  const [outcome, setOutcome] = useState(latestOutcome);
  const [saveFailed, setSaveFailed] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const startedAt = useRef(Date.now());
  const situation = situationOf(task, snapshot);
  const references = useMemo(
    () => referenceSentences(activity, items),
    [activity, items],
  );
  const dialogue =
    activity.kind === 'role_play' && activity.content
      ? (activity.content as RolePlayContent)
      : null;

  const toggle = (criterion: Criterion) =>
    setTicked(previous => {
      const next = new Set(previous);
      if (next.has(criterion)) next.delete(criterion);
      else next.add(criterion);
      return next;
    });

  const record = () => {
    const result = criteriaOutcome(task.criteria, ticked);
    const saved = onFinished(result, 'none', Date.now() - startedAt.current);
    setSaveFailed(!saved);
    setOutcome(result);
    setPhase('done');
  };

  const restart = () => {
    startedAt.current = Date.now();
    setWritten('');
    setTicked(new Set());
    setShowReference(false);
    setSaveFailed(false);
    setPhase('answer');
  };

  return (
    <AppCard testID={`lesson-flow-independent-${block.id}`}>
      <View style={themedStyles.body}>
        <Chip label={t('lessonFlow.independent_label')} tone="coralSoft" />
        <AppText variant="h3">{task.title_vi || activity.titleVi}</AppText>
        {situation ? (
          <View style={themedStyles.situation} testID="lesson-flow-situation">
            <AppText>
              {t('lessonFlow.situation_line', {
                speaker: situation.speaker,
                listener: situation.listener,
                place: situation.place,
              })}
            </AppText>
            <AppText variant="label">
              {t('lessonFlow.situation_purpose', {purpose: situation.purpose})}
            </AppText>
          </View>
        ) : null}
        <AppText testID="lesson-flow-task-prompt">{task.prompt_vi}</AppText>

        {phase === 'answer' ? (
          <>
            {dialogue
              ? dialogue.turns.map(turn =>
                  turn.speaker === dialogue.learnerSpeaker ? (
                    <AppText
                      color="secondary"
                      key={turn.id}
                      testID="lesson-flow-independent-your-turn"
                      variant="label"
                    >
                      {t('lessonFlow.independent_your_turn', {
                        speaker: turn.speaker,
                      })}
                    </AppText>
                  ) : (
                    <View
                      key={turn.id}
                      style={themedStyles.line}
                      testID="lesson-flow-partner-line"
                    >
                      <AppText style={themedStyles.flex} variant="label">
                        {turn.speaker}: {turn.textEn}
                      </AppText>
                      <IconButton
                        accessibilityHint={t('lessonFlow.listen_line_hint')}
                        accessibilityLabel={t('lessonFlow.listen_line')}
                        icon="volume_up"
                        onPress={() => {
                          speak(turn.textEn).catch(() => undefined);
                        }}
                      />
                    </View>
                  ),
                )
              : null}
            {task.response_mode === 'write' ? (
              <TextField
                accessibilityHint={t('lessonFlow.independent_write_hint')}
                accessibilityLabel={t('lessonFlow.answer_label')}
                multiline
                onChangeText={setWritten}
                placeholder={t('lessonFlow.answer_placeholder')}
                testID="lesson-flow-independent-text"
                value={written}
              />
            ) : (
              <RecorderControls />
            )}
            <AppButton
              accessibilityHint={t('lessonFlow.independent_done_hint')}
              disabled={task.response_mode === 'write' && !written.trim()}
              onPress={() => setPhase('judge')}
              testID="lesson-flow-independent-done"
              title={t('lessonFlow.independent_done')}
            />
          </>
        ) : null}

        {phase === 'judge' ? (
          <>
            <AppText variant="label">
              {t('lessonFlow.criteria_question')}
            </AppText>
            <CriteriaChecklist
              criteria={task.criteria}
              onToggle={toggle}
              ticked={ticked}
            />
            <AppButton
              accessibilityHint={t('lessonFlow.criteria_save_hint')}
              onPress={record}
              testID="lesson-flow-criteria-save"
              title={t('lessonFlow.criteria_save')}
            />
          </>
        ) : null}

        {phase === 'done' ? (
          <View style={themedStyles.body}>
            {outcome ? (
              <AppText testID="lesson-flow-activity-outcome" variant="label">
                {t(`lessonFlow.outcome_${outcome}`)}
              </AppText>
            ) : null}
            {saveFailed ? (
              <AppText color="danger" testID="lesson-flow-activity-save-error">
                {t('lessonFlow.save_failed')}
              </AppText>
            ) : null}
            {references.length > 0 ? (
              showReference ? (
                <View style={themedStyles.body} testID="lesson-flow-reference">
                  {references.map((sentence, index) => (
                    <AppText key={`${index}-${sentence}`}>{sentence}</AppText>
                  ))}
                </View>
              ) : (
                <AppButton
                  accessibilityHint={t('lessonFlow.show_reference_hint')}
                  onPress={() => setShowReference(true)}
                  testID="lesson-flow-show-reference"
                  title={t('lessonFlow.show_reference')}
                  variant="ghost"
                />
              )
            ) : null}
            <AppButton
              accessibilityHint={t('lessonFlow.redo_hint')}
              onPress={restart}
              testID="lesson-flow-activity-redo"
              title={t('lessonFlow.redo')}
              variant="outline"
            />
          </View>
        ) : null}
      </View>
    </AppCard>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    body: {
      gap: theme.spacing.sm,
    },
    flex: {
      flex: 1,
    },
    line: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    situation: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.md,
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
    },
  });
}
