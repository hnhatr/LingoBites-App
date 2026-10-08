import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {TextField} from '@ui/components/TextField';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {EntryResult} from '../logic/activityOutcome';
import {isAccepted} from '../logic/flowContent';

export type TypedEntryProps = {
  /** Normalised accepted answers (`acceptedFor` / `normalizeAnswer`). */
  accepted: readonly string[];
  /** Shown once the entry ends. */
  modelAnswer: string;
  onReport: (result: EntryResult) => void;
};

/**
 * Type the answer in English. It is checked like on the Server (decision
 * G9); a wrong answer can be corrected, which then counts as a retry. The
 * typed text never leaves this component.
 */
export function TypedEntry({accepted, modelAnswer, onReport}: TypedEntryProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [value, setValue] = useState('');
  const [wrongTries, setWrongTries] = useState(0);
  const [finished, setFinished] = useState<'right' | 'shown' | null>(null);

  const check = () => {
    if (finished || value.trim() === '') return;
    if (isAccepted(value, accepted)) {
      setFinished('right');
      onReport(wrongTries === 0 ? 'first_try' : 'after_retry');
    } else {
      setWrongTries(tries => tries + 1);
    }
  };

  return (
    <View style={themedStyles.container}>
      <TextField
        accessibilityHint={t('lessonFlow.answer_hint')}
        accessibilityLabel={t('lessonFlow.answer_label')}
        autoCapitalize="none"
        autoCorrect={false}
        editable={finished === null}
        onChangeText={setValue}
        onSubmitEditing={check}
        placeholder={t('lessonFlow.answer_placeholder')}
        testID="lesson-flow-answer-input"
        value={value}
      />
      {finished === null ? (
        <View style={themedStyles.actions}>
          <AppButton
            accessibilityHint={t('lessonFlow.check_hint')}
            disabled={value.trim() === ''}
            onPress={check}
            style={themedStyles.flex}
            testID="lesson-flow-check"
            title={t('lessonFlow.check')}
          />
          <AppButton
            accessibilityHint={t('lessonFlow.show_answer_hint')}
            onPress={() => {
              setFinished('shown');
              onReport('not_yet');
            }}
            testID="lesson-flow-show-answer"
            title={t('lessonFlow.show_answer')}
            variant="ghost"
          />
        </View>
      ) : null}
      {finished === null && wrongTries > 0 ? (
        <AppText color="secondary" testID="lesson-flow-feedback-wrong">
          {t('lessonFlow.feedback_wrong_typed')}
        </AppText>
      ) : null}
      {finished === 'right' ? (
        <AppText testID="lesson-flow-feedback-right" variant="label">
          {t('lessonFlow.feedback_right')}
        </AppText>
      ) : null}
      {finished !== null ? (
        <AppText color="secondary" testID="lesson-flow-model-answer">
          {t('lessonFlow.model_answer', {answer: modelAnswer})}
        </AppText>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    actions: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    container: {
      gap: theme.spacing.sm,
    },
    flex: {
      flex: 1,
    },
  });
}
