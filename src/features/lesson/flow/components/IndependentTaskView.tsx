import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {speak} from '@features/audio';
import {
  setEvaluationConsent,
  shouldAskEvaluationConsent,
} from '@features/speaking';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {IconButton} from '@ui/components/IconButton';
import {TextField} from '@ui/components/TextField';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {createRequestId} from '@core/api/requestId';
import type {RolePlayContent} from '@core/schemas/activityContent';
import type {EvaluationPayload} from '@core/schemas/evaluation';
import type {
  LessonBlock,
  LessonSnapshot,
  LessonTask,
} from '@core/schemas/lesson';
import type {
  LessonAttemptOutcome,
  LessonSupportLevel,
} from '@core/schemas/sync';
import {
  latestTaskAnswerForBlock,
  subscribeTaskAnswers,
} from '@core/sync/taskAnswers';

import type {FlowActivity, FlowItems} from '../logic/flowContent';
import {
  criteriaOutcome,
  type Criterion,
  referenceSentences,
  situationOf,
} from '../logic/independent';
import {
  answerExpired,
  pollEvaluation,
  refreshSpeechEvaluation,
  speechEvaluationKnownEnabled,
  speechGradingReady,
  submitSpokenAnswer,
  submitWrittenAnswer,
} from '../logic/taskEvaluation';
import {useSelfCheckRecorder} from '../logic/useSelfCheckRecorder';
import {CriteriaChecklist} from './CriteriaChecklist';
import {EvaluationConsentPrompt} from './EvaluationConsentPrompt';
import {EvaluationFeedback} from './EvaluationFeedback';
import {RecorderControls} from './RecorderControls';

/** Decision A6: a step-5 spoken answer lasts at most 45 seconds. */
export const STEP5_MAX_RECORDING_MS = 45_000;

export type GradedAttempt = {attemptId: string; recordingClientId?: string};

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
    graded?: GradedAttempt,
  ) => boolean;
  /** PR 14: back to the practice steps after a failed graded answer. */
  onPracticeRelated?: () => void;
  /** PR 14 (decision H8): a speaking task is answered in writing for now. */
  writeInstead?: boolean;
};

type Phase =
  | 'answer'
  | 'consent'
  | 'judge'
  | 'done'
  | 'grading'
  | 'graded'
  | 'not_graded';

/** How this answer is judged (decisions H5, H6, H8). */
type Grading = 'speech' | 'text' | 'self' | 'ask';

function gradingFor(task: LessonTask, writeInstead: boolean): Grading {
  if (task.response_mode === 'write' || writeInstead) return 'text';
  if (speechGradingReady()) return 'speech';
  if (speechEvaluationKnownEnabled() && shouldAskEvaluationConsent()) {
    return 'ask';
  }
  return 'self';
}

/**
 * Step 5, independent use (decisions G4–G5): the task's situation, no model
 * and no hints. PR 14: a written answer, and a spoken one when the Server
 * grades speech for this learner and they agreed, goes to the Server's
 * scorer; otherwise the learner ticks the task's criteria as before. Only
 * then can the reference sentences be seen, which changes nothing recorded.
 */
export function IndependentTaskView({
  block,
  activity,
  task,
  snapshot,
  items,
  latestOutcome,
  onFinished,
  onPracticeRelated,
  writeInstead = false,
}: IndependentTaskViewProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [grading, setGrading] = useState<Grading>(() =>
    gradingFor(task, writeInstead),
  );
  const substitute = writeInstead && task.response_mode === 'speak';
  const [phase, setPhase] = useState<Phase>(() => {
    const answer = latestTaskAnswerForBlock(block.id);
    if (latestOutcome === 'pending' && answer) {
      if (answer.evaluation) return 'graded';
      return answerExpired(answer) ? 'not_graded' : 'grading';
    }
    return latestOutcome ? 'done' : 'answer';
  });
  const [attemptId, setAttemptId] = useState<string | null>(
    () => latestTaskAnswerForBlock(block.id)?.attemptId ?? null,
  );
  const [evaluation, setEvaluation] = useState<EvaluationPayload | null>(
    () => latestTaskAnswerForBlock(block.id)?.evaluation ?? null,
  );
  const [waitingNetwork, setWaitingNetwork] = useState(false);
  const [written, setWritten] = useState('');
  const [ticked, setTicked] = useState<ReadonlySet<Criterion>>(new Set());
  const [outcome, setOutcome] = useState(latestOutcome);
  const [saveFailed, setSaveFailed] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const startedAt = useRef(Date.now());
  const mounted = useRef(true);
  const recorder = useSelfCheckRecorder(undefined, {
    forGrading: grading === 'speech',
    maxMs: STEP5_MAX_RECORDING_MS,
  });
  const situation = situationOf(task, snapshot);
  const references = useMemo(
    () => referenceSentences(activity, items),
    [activity, items],
  );
  const dialogue =
    activity.kind === 'role_play' && activity.content
      ? (activity.content as RolePlayContent)
      : null;
  const target = useMemo(
    () => ({lesson_id: snapshot.id, block_id: block.id}),
    [snapshot.id, block.id],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Ask the Server whether it grades speech for this learner (H5).
  useEffect(() => {
    if (task.response_mode !== 'speak' || writeInstead) return;
    refreshSpeechEvaluation()
      .then(() => {
        if (mounted.current) setGrading(gradingFor(task, writeInstead));
      })
      .catch(() => undefined);
  }, [task, writeInstead]);

  useEffect(() => {
    setGrading(gradingFor(task, writeInstead));
  }, [task, writeInstead]);

  // A result may arrive another way (sync pull) while waiting.
  useEffect(
    () =>
      subscribeTaskAnswers(() => {
        if (!attemptId) return;
        const answer = latestTaskAnswerForBlock(block.id);
        if (answer?.attemptId === attemptId && answer.evaluation) {
          setEvaluation(answer.evaluation);
          setPhase('graded');
        }
      }),
    [attemptId, block.id],
  );

  const wait = useCallback((id: string) => {
    setWaitingNetwork(false);
    pollEvaluation(id, {shouldStop: () => !mounted.current})
      .then(result => {
        if (!mounted.current) return;
        if (result) {
          setEvaluation(result);
          setPhase('graded');
        } else {
          setWaitingNetwork(true);
        }
      })
      .catch(() => {
        if (mounted.current) setWaitingNetwork(true);
      });
  }, []);

  // Reopened while a spoken answer was still being graded.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || phase !== 'grading' || !attemptId) return;
    resumed.current = true;
    const answer = latestTaskAnswerForBlock(block.id);
    if (answer?.source === 'speech') wait(attemptId);
    else setWaitingNetwork(true);
  }, [phase, attemptId, block.id, wait]);

  const toggle = (criterion: Criterion) =>
    setTicked(previous => {
      const next = new Set(previous);
      if (next.has(criterion)) next.delete(criterion);
      else next.add(criterion);
      return next;
    });

  const recordSelf = () => {
    const result = criteriaOutcome(task.criteria, ticked);
    const saved = onFinished(result, 'none', Date.now() - startedAt.current);
    setSaveFailed(!saved);
    setOutcome(result);
    setPhase('done');
  };

  const send = () => {
    const id = createRequestId();
    const durationMs = Date.now() - startedAt.current;
    if (grading === 'speech') {
      const take = recorder.release();
      if (!take) return;
      const recordingId = createRequestId();
      const saved = onFinished('pending', 'none', durationMs, {
        attemptId: id,
        recordingClientId: recordingId,
      });
      setSaveFailed(!saved);
      if (!saved) return;
      submitSpokenAnswer({
        attemptId: id,
        recordingId,
        target,
        taskId: task.id,
        supportLevel: 'none',
        filePath: take.filePath,
        durationMs: Math.max(take.durationMs, 1),
      });
      setAttemptId(id);
      setPhase('grading');
      wait(id);
      return;
    }
    const text = written.trim();
    if (!text) return;
    const saved = onFinished('pending', 'none', durationMs, {attemptId: id});
    setSaveFailed(!saved);
    if (!saved) return;
    setAttemptId(id);
    setPhase('grading');
    submitWrittenAnswer({
      attemptId: id,
      target,
      taskId: task.id,
      text,
      substitute,
      supportLevel: 'none',
    })
      .then(result => {
        if (!mounted.current) return;
        if (result.status === 'evaluated') {
          setEvaluation(result.evaluation);
          setPhase('graded');
        } else if (result.status === 'waiting') {
          setWaitingNetwork(true);
        } else {
          setPhase('not_graded');
        }
      })
      .catch(() => {
        if (mounted.current) setWaitingNetwork(true);
      });
  };

  const restart = () => {
    startedAt.current = Date.now();
    setWritten('');
    setTicked(new Set());
    setShowReference(false);
    setSaveFailed(false);
    setEvaluation(null);
    setWaitingNetwork(false);
    setAttemptId(null);
    setGrading(gradingFor(task, writeInstead));
    setPhase('answer');
  };

  const answerConsent = (agreed: boolean) => {
    setEvaluationConsent(agreed ? 'on' : 'off');
    setGrading(agreed ? 'speech' : 'self');
    setPhase('answer');
  };

  const graded = grading === 'speech' || grading === 'text';
  const canFinishAnswer =
    grading === 'text' || task.response_mode === 'write'
      ? written.trim().length > 0
      : grading === 'speech'
      ? recorder.state === 'recorded'
      : true;

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

        {phase === 'answer' && grading === 'ask' ? (
          <EvaluationConsentPrompt onAnswer={answerConsent} />
        ) : null}

        {phase === 'answer' && grading !== 'ask' ? (
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
            {substitute ? (
              <AppText color="secondary" testID="lesson-flow-write-instead">
                {t('lessonFlow.no_speaking_active')}
              </AppText>
            ) : null}
            {task.response_mode === 'write' || grading === 'text' ? (
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
              <RecorderControls recorder={recorder} />
            )}
            {graded ? (
              <AppButton
                accessibilityHint={t('lessonFlow.evaluation_send_hint')}
                disabled={!canFinishAnswer}
                onPress={send}
                testID="lesson-flow-evaluation-send"
                title={t('lessonFlow.evaluation_send')}
              />
            ) : (
              <AppButton
                accessibilityHint={t('lessonFlow.independent_done_hint')}
                disabled={!canFinishAnswer}
                onPress={() => setPhase('judge')}
                testID="lesson-flow-independent-done"
                title={t('lessonFlow.independent_done')}
              />
            )}
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
              onPress={recordSelf}
              testID="lesson-flow-criteria-save"
              title={t('lessonFlow.criteria_save')}
            />
          </>
        ) : null}

        {phase === 'grading' ? (
          <AppText testID="lesson-flow-evaluation-grading">
            {waitingNetwork
              ? t('lessonFlow.evaluation_wait_network')
              : t('lessonFlow.evaluation_grading')}
          </AppText>
        ) : null}

        {phase === 'graded' && evaluation ? (
          <EvaluationFeedback
            evaluation={evaluation}
            onPracticeRelated={onPracticeRelated}
            onRetry={restart}
          />
        ) : null}

        {phase === 'not_graded' ? (
          <View style={themedStyles.body}>
            <AppText testID="lesson-flow-evaluation-not-graded">
              {t('lessonFlow.evaluation_expired')}
            </AppText>
            <AppButton
              accessibilityHint={t('lessonFlow.redo_hint')}
              onPress={restart}
              testID="lesson-flow-activity-redo"
              title={t('lessonFlow.redo')}
              variant="outline"
            />
          </View>
        ) : null}

        {saveFailed ? (
          <AppText color="danger" testID="lesson-flow-activity-save-error">
            {t('lessonFlow.save_failed')}
          </AppText>
        ) : null}

        {phase === 'done' ? (
          <View style={themedStyles.body}>
            {outcome ? (
              <AppText testID="lesson-flow-activity-outcome" variant="label">
                {t(`lessonFlow.outcome_${outcome}`)}
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
