import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {
  setEvaluationConsent,
  shouldAskEvaluationConsent,
} from '@features/speaking';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {TextField} from '@ui/components/TextField';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {createRequestId} from '@core/api/requestId';
import type {EvaluationPayload} from '@core/schemas/evaluation';
import type {UnitSummativeTask} from '@core/schemas/lesson';
import {
  listTaskAnswersForUnit,
  subscribeTaskAnswers,
  type TaskAnswer,
} from '@core/sync/taskAnswers';

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
import {EvaluationConsentPrompt} from './EvaluationConsentPrompt';
import {EvaluationFeedback} from './EvaluationFeedback';
import {RecorderControls} from './RecorderControls';

/** Server limit for a unit's spoken answer (recordings `lesson_task`, unit). */
export const SUMMATIVE_MAX_RECORDING_MS = 90_000;

type Phase = 'answer' | 'grading' | 'graded' | 'not_graded';

/**
 * How the answer is graded. The summative task has no self-assessment
 * (decision G5): without speech grading a spoken task is written instead,
 * which is graded but does not pass the unit (P5).
 */
type Grading = 'speech' | 'text' | 'ask';

function gradingFor(task: UnitSummativeTask, writeInstead: boolean): Grading {
  if (task.response_mode !== 'speak' || writeInstead) return 'text';
  if (speechGradingReady()) return 'speech';
  if (speechEvaluationKnownEnabled() && shouldAskEvaluationConsent()) {
    return 'ask';
  }
  return 'text';
}

function initialPhase(answer: TaskAnswer | undefined): Phase {
  if (!answer) return 'answer';
  if (answer.evaluation) return 'graded';
  return answerExpired(answer) ? 'not_graded' : 'grading';
}

export type SummativeTaskViewProps = {
  task: UnitSummativeTask;
};

/**
 * PR 16 (decisions B4, G5–G6): the unit's summative task, graded by the
 * Server's scorer like step 5 with the target `unit_id + task_id`. No hints
 * and no reference sentences; nothing goes to `activity_attempts`.
 */
export function SummativeTaskView({task}: SummativeTaskViewProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [answer] = useState(() => listTaskAnswersForUnit(task.unit_id)[0]);
  const [writeInstead, setWriteInstead] = useState(false);
  const [grading, setGrading] = useState<Grading>(() =>
    gradingFor(task, false),
  );
  const [phase, setPhase] = useState<Phase>(() => initialPhase(answer));
  const [attemptId, setAttemptId] = useState<string | null>(
    answer?.attemptId ?? null,
  );
  const [evaluation, setEvaluation] = useState<EvaluationPayload | null>(
    answer?.evaluation ?? null,
  );
  const [waitingNetwork, setWaitingNetwork] = useState(
    answer != null && answer.source === 'text' && !answer.evaluation,
  );
  const [written, setWritten] = useState('');
  const mounted = useRef(true);
  const recorder = useSelfCheckRecorder(undefined, {
    forGrading: grading === 'speech',
    maxMs: SUMMATIVE_MAX_RECORDING_MS,
  });
  const target = useMemo(
    () => ({unit_id: task.unit_id, task_id: task.id}),
    [task.unit_id, task.id],
  );
  /** A spoken task answered in writing: graded, but it cannot pass the unit. */
  const substitute = task.response_mode === 'speak';

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // No recorder on this device: the spoken task is written instead.
  useEffect(() => {
    if (grading === 'speech' && recorder.state === 'unavailable') {
      setGrading('text');
    }
  }, [grading, recorder.state]);

  useEffect(() => {
    if (task.response_mode !== 'speak') return;
    refreshSpeechEvaluation()
      .then(() => {
        if (mounted.current) setGrading(gradingFor(task, writeInstead));
      })
      .catch(() => undefined);
  }, [task, writeInstead]);

  // A result may arrive another way (sync pull) while waiting.
  useEffect(
    () =>
      subscribeTaskAnswers(() => {
        if (!attemptId) return;
        const found = listTaskAnswersForUnit(task.unit_id).find(
          row => row.attemptId === attemptId,
        );
        if (found?.evaluation) {
          setEvaluation(found.evaluation);
          setPhase('graded');
        }
      }),
    [attemptId, task.unit_id],
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
    if (resumed.current || phase !== 'grading' || !answer) return;
    resumed.current = true;
    if (answer.source === 'speech') wait(answer.attemptId);
  }, [phase, answer, wait]);

  const send = () => {
    const id = createRequestId();
    if (grading === 'speech') {
      const take = recorder.release();
      if (!take) return;
      submitSpokenAnswer({
        attemptId: id,
        recordingId: createRequestId(),
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
    setWritten('');
    setEvaluation(null);
    setWaitingNetwork(false);
    setAttemptId(null);
    setGrading(gradingFor(task, writeInstead));
    setPhase('answer');
  };

  const answerConsent = (agreed: boolean) => {
    setEvaluationConsent(agreed ? 'on' : 'off');
    if (!agreed) setWriteInstead(true);
    setGrading(agreed ? 'speech' : 'text');
  };

  const chooseWriting = () => {
    setWriteInstead(true);
    setGrading('text');
  };

  const canSend =
    grading === 'speech'
      ? recorder.state === 'recorded'
      : written.trim().length > 0;

  return (
    <AppCard testID="unit-summative-task">
      <View style={themedStyles.body}>
        <Chip label={t('summativeTask.label')} tone="coralSoft" />
        <AppText variant="h3">{task.title_vi}</AppText>
        {task.situation ? (
          <View
            style={themedStyles.situation}
            testID="unit-summative-situation"
          >
            <AppText>
              {t('lessonFlow.situation_line', {
                speaker: task.situation.speaker,
                listener: task.situation.listener,
                place: task.situation.place,
              })}
            </AppText>
            <AppText variant="label">
              {t('lessonFlow.situation_purpose', {
                purpose: task.situation.purpose,
              })}
            </AppText>
          </View>
        ) : null}
        <AppText testID="unit-summative-prompt">{task.prompt_vi}</AppText>

        {phase === 'answer' && grading === 'ask' ? (
          <EvaluationConsentPrompt
            declineLabel={t('summativeTask.write_instead')}
            onAnswer={answerConsent}
          />
        ) : null}

        {phase === 'answer' && grading !== 'ask' ? (
          <>
            {substitute && grading === 'text' ? (
              <AppText color="secondary" testID="unit-summative-write-instead">
                {t('summativeTask.write_instead_note')}
              </AppText>
            ) : null}
            {grading === 'text' ? (
              <TextField
                accessibilityHint={t('lessonFlow.independent_write_hint')}
                accessibilityLabel={t('lessonFlow.answer_label')}
                multiline
                onChangeText={setWritten}
                placeholder={t('lessonFlow.answer_placeholder')}
                testID="unit-summative-text"
                value={written}
              />
            ) : (
              <>
                <RecorderControls recorder={recorder} />
                <AppButton
                  accessibilityHint={t('summativeTask.write_instead_hint')}
                  onPress={chooseWriting}
                  testID="unit-summative-choose-writing"
                  title={t('summativeTask.write_instead')}
                  variant="ghost"
                />
              </>
            )}
            <AppButton
              accessibilityHint={t('lessonFlow.evaluation_send_hint')}
              disabled={!canSend}
              onPress={send}
              testID="unit-summative-send"
              title={t('lessonFlow.evaluation_send')}
            />
          </>
        ) : null}

        {phase === 'grading' ? (
          <AppText testID="unit-summative-grading">
            {waitingNetwork
              ? t('lessonFlow.evaluation_wait_network')
              : t('lessonFlow.evaluation_grading')}
          </AppText>
        ) : null}

        {phase === 'graded' && evaluation ? (
          <>
            <EvaluationFeedback evaluation={evaluation} onRetry={restart} />
            {evaluation.outcome === 'pass_independent' &&
            evaluation.substitute ? (
              <AppText
                color="secondary"
                testID="unit-summative-substitute-note"
              >
                {t('summativeTask.substitute_not_passing')}
              </AppText>
            ) : null}
          </>
        ) : null}

        {phase === 'not_graded' ? (
          <View style={themedStyles.body}>
            <AppText testID="unit-summative-not-graded">
              {t('lessonFlow.evaluation_expired')}
            </AppText>
            <AppButton
              accessibilityHint={t('lessonFlow.redo_hint')}
              onPress={restart}
              testID="unit-summative-redo"
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
    situation: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.md,
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
    },
  });
}
