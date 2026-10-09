import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {
  type EvaluationCriterion,
  EvaluationCriterionValues,
  type EvaluationPayload,
} from '@core/schemas/evaluation';

export type EvaluationFeedbackProps = {
  evaluation: EvaluationPayload;
  onRetry: () => void;
  /** Back to the practice steps (decision H9: "Luyện phần liên quan"). */
  onPracticeRelated?: () => void;
};

/**
 * PR 14 (decision H9): the scorer's result in four states. A pass lists the
 * criteria met; a fail names the main issue, the missing words and the
 * reference sentence; "could not grade" is never a failure.
 */
export function EvaluationFeedback({
  evaluation,
  onRetry,
  onPracticeRelated,
}: EvaluationFeedbackProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const criterion = (name: EvaluationCriterion) =>
    t(`lessonFlow.evaluation_criterion_${name}`);

  const title =
    evaluation.substitute &&
    evaluation.outcome !== 'fail' &&
    evaluation.outcome !== 'unscorable'
      ? t('lessonFlow.evaluation_substitute_pass')
      : t(`lessonFlow.evaluation_${evaluation.outcome}`);
  const issue = evaluation.primary_issue;
  const issueText =
    issue?.kind === 'error'
      ? evaluation.errors.find(error => error.code === issue.code)
          ?.feedback_vi ?? null
      : issue?.kind === 'criterion'
      ? criterion(issue.criterion)
      : null;
  const reminders = evaluation.errors.filter(
    error => error.severity === 'tolerated',
  );

  return (
    <View style={themedStyles.body} testID="lesson-flow-evaluation">
      <AppText testID="lesson-flow-evaluation-title" variant="h3">
        {title}
      </AppText>

      {evaluation.outcome === 'pass_independent' ||
      evaluation.outcome === 'pass_with_support' ? (
        <View style={themedStyles.list} testID="lesson-flow-evaluation-met">
          {EvaluationCriterionValues.filter(
            name => evaluation.criteria[name].passed,
          ).map(name => (
            <AppText key={name}>✓ {criterion(name)}</AppText>
          ))}
        </View>
      ) : null}

      {evaluation.outcome === 'fail' && issueText ? (
        <AppText testID="lesson-flow-evaluation-issue">{issueText}</AppText>
      ) : null}
      {evaluation.outcome === 'fail' && evaluation.missing_words.length > 0 ? (
        <AppText color="secondary" testID="lesson-flow-evaluation-missing">
          {t('lessonFlow.evaluation_missing_words', {
            words: evaluation.missing_words.join(', '),
          })}
        </AppText>
      ) : null}
      {evaluation.outcome !== 'fail'
        ? reminders.map(error => (
            <AppText color="secondary" key={error.code}>
              {error.feedback_vi}
            </AppText>
          ))
        : null}
      {evaluation.outcome === 'unscorable' && evaluation.unscorable_reason ? (
        <AppText color="secondary" testID="lesson-flow-evaluation-reason">
          {t(`lessonFlow.evaluation_reason_${evaluation.unscorable_reason}`)}
        </AppText>
      ) : null}
      {evaluation.reference_en && evaluation.outcome !== 'unscorable' ? (
        <AppText testID="lesson-flow-evaluation-reference" variant="label">
          {t('lessonFlow.evaluation_reference', {
            sentence: evaluation.reference_en,
          })}
        </AppText>
      ) : null}

      {evaluation.outcome === 'fail' && onPracticeRelated ? (
        <AppButton
          accessibilityHint={t('lessonFlow.evaluation_practice_related_hint')}
          onPress={onPracticeRelated}
          testID="lesson-flow-evaluation-practice"
          title={t('lessonFlow.evaluation_practice_related')}
          variant="outline"
        />
      ) : null}
      {evaluation.outcome !== 'pass_independent' ? (
        <AppButton
          accessibilityHint={t('lessonFlow.redo_hint')}
          onPress={onRetry}
          testID="lesson-flow-evaluation-retry"
          title={
            evaluation.outcome === 'pass_with_support'
              ? t('lessonFlow.evaluation_retry_no_hint')
              : t('lessonFlow.evaluation_retry')
          }
          variant="outline"
        />
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    body: {
      gap: theme.spacing.sm,
    },
    list: {
      gap: theme.spacing.xs,
    },
  });
}
