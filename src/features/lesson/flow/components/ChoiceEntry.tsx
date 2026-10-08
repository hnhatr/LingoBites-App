import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {QuizOption, type QuizOptionState} from '@ui/components/QuizOption';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonSupportLevel} from '@core/schemas/sync';

import type {EntryResult} from '../logic/activityOutcome';

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export type ChoiceEntryProps = {
  options: ReadonlyArray<{id: string; text: string}>;
  rightId: string;
  onReport: (result: EntryResult, support: LessonSupportLevel) => void;
};

/**
 * Pick one option. A wrong pick is marked and the learner picks again; the
 * right one ends the entry (after a wrong pick it counts as a retry). "Xem
 * đáp án" shows the right option and counts as not done (decision G9).
 */
export function ChoiceEntry({options, rightId, onReport}: ChoiceEntryProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [wrong, setWrong] = useState<ReadonlySet<string>>(new Set());
  const [finished, setFinished] = useState<'right' | 'shown' | null>(null);
  /** The one hint of a choice (PR 11 G3): a wrong option taken away. */
  const [removed, setRemoved] = useState<string | null>(null);
  const support: LessonSupportLevel = removed ? 'hint_1' : 'none';
  const canEliminate =
    removed === null &&
    options.filter(o => o.id !== rightId && !wrong.has(o.id)).length > 1;

  const choose = (id: string) => {
    if (finished) return;
    if (id === rightId) {
      setFinished('right');
      onReport(wrong.size === 0 ? 'first_try' : 'after_retry', support);
    } else {
      setWrong(previous => new Set(previous).add(id));
    }
  };

  const optionState = (id: string): QuizOptionState => {
    if (finished && id === rightId) return 'correct';
    return wrong.has(id) || removed === id ? 'wrong' : 'default';
  };

  return (
    <View style={themedStyles.container}>
      {options.map((option, index) => {
        const key = OPTION_KEYS[index] ?? String(index + 1);
        return (
          <QuizOption
            accessibilityHint={t('lessonFlow.option_hint')}
            accessibilityLabel={t('lessonFlow.option_a11y', {
              key,
              text: option.text,
            })}
            disabled={
              finished !== null || wrong.has(option.id) || removed === option.id
            }
            key={option.id}
            label={option.text}
            onPress={() => choose(option.id)}
            optionKey={key}
            state={optionState(option.id)}
            testID={`lesson-flow-option-${index}`}
          />
        );
      })}
      {finished === 'right' ? (
        <AppText testID="lesson-flow-feedback-right" variant="label">
          {t('lessonFlow.feedback_right')}
        </AppText>
      ) : null}
      {finished === null && wrong.size > 0 ? (
        <AppText color="secondary" testID="lesson-flow-feedback-wrong">
          {t('lessonFlow.feedback_wrong_choice')}
        </AppText>
      ) : null}
      {finished === null && canEliminate ? (
        <AppButton
          accessibilityHint={t('lessonFlow.hint_eliminate_hint')}
          iconLeft="lightbulb"
          onPress={() =>
            setRemoved(
              options.find(o => o.id !== rightId && !wrong.has(o.id))?.id ??
                null,
            )
          }
          testID="lesson-flow-hint-eliminate"
          title={t('lessonFlow.hint_eliminate')}
          variant="ghost"
        />
      ) : null}
      {finished === null ? (
        <AppButton
          accessibilityHint={t('lessonFlow.show_answer_hint')}
          onPress={() => {
            setFinished('shown');
            onReport('not_yet', support);
          }}
          testID="lesson-flow-show-answer"
          title={t('lessonFlow.show_answer')}
          variant="ghost"
        />
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.sm,
    },
  });
}
