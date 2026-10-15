import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {
  setEvaluationConsent,
  shouldAskEvaluationConsent,
} from '@features/speaking';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {withAlpha} from '@ui/components/layout';
import {TextField} from '@ui/components/TextField';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

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

import {
  StudyLabel,
  StudyNavButton,
} from '../../player/components/StudyControls';
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
import {PartnerBubble, TurnBubble} from './ChatBubble';
import {CriteriaChecklist} from './CriteriaChecklist';
import {EvaluationConsentPrompt} from './EvaluationConsentPrompt';
import {EvaluationFeedback} from './EvaluationFeedback';
import {type FlowFooterAction, useFlowFooter} from './FlowFooter';
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
  'answer' | 'consent' | 'judge' | 'done' | 'grading' | 'graded' | 'not_graded';

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

  // The answer's main button sits in the player's bottom bar.
  const mainAction: FlowFooterAction | null =
    phase === 'answer' && grading !== 'ask'
      ? graded
        ? {
            title: t('lessonFlow.evaluation_send'),
            hint: t('lessonFlow.evaluation_send_hint'),
            testID: 'lesson-flow-evaluation-send',
            onPress: send,
            disabled: !canFinishAnswer,
          }
        : {
            title: t('lessonFlow.independent_done'),
            hint: t('lessonFlow.independent_done_hint'),
            testID: 'lesson-flow-independent-done',
            onPress: () => setPhase('judge'),
            disabled: !canFinishAnswer,
          }
      : phase === 'judge'
        ? {
            title: t('lessonFlow.criteria_save'),
            hint: t('lessonFlow.criteria_save_hint'),
            testID: 'lesson-flow-criteria-save',
            onPress: recordSelf,
          }
        : null;
  const hosted = useFlowFooter(mainAction, 2);
  const inlineAction =
    mainAction && !hosted ? (
      <StudyNavButton
        accessibilityHint={mainAction.hint}
        disabled={mainAction.disabled}
        label={mainAction.title}
        onPress={mainAction.onPress}
        testID={mainAction.testID}
        tone="coral"
      />
    ) : null;

  return (
    <View
      style={themedStyles.page}
      testID={`lesson-flow-independent-${block.id}`}
    >
      <AppText variant="h2">{task.title_vi || activity.titleVi}</AppText>
      <View style={themedStyles.scenario}>
        <StudyLabel color={theme.colors.primary}>
          {t('lessonFlow.situation_label')}
        </StudyLabel>
        {situation ? (
          <View style={themedStyles.body} testID="lesson-flow-situation">
            <View style={themedStyles.roles}>
              <RoleTile
                label={t('lessonFlow.situation_you')}
                me
                name={situation.speaker}
              />
              <RoleTile
                label={t('lessonFlow.situation_to')}
                name={situation.listener}
              />
            </View>
            <AppText>
              {t('lessonFlow.situation_place', {place: situation.place})}
            </AppText>
            <AppText>
              <AppText style={themedStyles.bold}>
                {t('lessonFlow.situation_purpose_label')}
              </AppText>
              {` ${situation.purpose}`}
            </AppText>
          </View>
        ) : null}
        <AppText testID="lesson-flow-task-prompt">{task.prompt_vi}</AppText>
      </View>
      <View style={themedStyles.body}>
        {phase === 'answer' && grading === 'ask' ? (
          <EvaluationConsentPrompt onAnswer={answerConsent} />
        ) : null}

        {phase === 'answer' && grading !== 'ask' ? (
          <>
            {dialogue
              ? dialogue.turns.map(turn =>
                  turn.speaker === dialogue.learnerSpeaker ? (
                    <TurnBubble
                      key={turn.id}
                      testID="lesson-flow-independent-your-turn"
                    >
                      <AppText variant="label">
                        {t('lessonFlow.independent_your_turn', {
                          speaker: turn.speaker,
                        })}
                      </AppText>
                    </TurnBubble>
                  ) : (
                    <PartnerBubble
                      key={turn.id}
                      speaker={turn.speaker}
                      testID="lesson-flow-partner-line"
                      textEn={turn.textEn}
                      textVi={turn.textVi}
                    />
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
            {inlineAction}
          </>
        ) : null}

        {phase === 'judge' ? (
          <>
            <CriteriaChecklist
              criteria={task.criteria}
              onToggle={toggle}
              ticked={ticked}
            />
            {inlineAction}
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
    </View>
  );
}

/** "Bạn là / Nói với" and who, on a white tile. */
function RoleTile({
  label,
  name,
  me = false,
}: {
  label: string;
  name: string;
  me?: boolean;
}) {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={themedStyles.role}>
      <View
        style={[
          themedStyles.roleBadge,
          me ? themedStyles.roleMe : themedStyles.roleOther,
        ]}
      >
        <AppText
          style={[
            themedStyles.roleBadgeText,
            me ? themedStyles.roleMeText : null,
          ]}
        >
          {name.charAt(0).toUpperCase()}
        </AppText>
      </View>
      <View style={themedStyles.flex}>
        <AppText color="muted" variant="caption">
          {label}
        </AppText>
        <AppText numberOfLines={2} style={themedStyles.bold}>
          {name}
        </AppText>
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  const {colors} = theme;
  return StyleSheet.create({
    body: {
      gap: theme.spacing.sm,
    },
    bold: {
      fontWeight: '700',
    },
    flex: {
      flex: 1,
    },
    page: {
      gap: theme.spacing.md,
    },
    role: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 14,
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      padding: 6,
      paddingRight: 10,
    },
    roleBadge: {
      alignItems: 'center',
      borderRadius: 10,
      height: 30,
      justifyContent: 'center',
      width: 30,
    },
    roleBadgeText: {
      color: HERO_PALETTE.skyInk,
      fontWeight: '800',
    },
    roleMe: {
      backgroundColor: HERO_PALETTE.coral,
    },
    roleMeText: {
      color: HERO_PALETTE.white,
    },
    roleOther: {
      backgroundColor: HERO_PALETTE.skySoft,
    },
    roles: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    scenario: {
      backgroundColor: solidOver(colors.accentSoft, colors.surface),
      borderColor: withAlpha(colors.accent, 0.45),
      borderRadius: 20,
      borderWidth: 1.5,
      gap: theme.spacing.sm,
      padding: 14,
    },
  });
}
