import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {useScreenSpeak} from '@features/audio';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {MultipleChoiceContent} from '@core/schemas/activityContent';

import {studyCardStyle} from '../../../player/components/StudyControls';
import type {EntryReport} from '../../logic/activityOutcome';
import {ChoiceEntry} from '../ChoiceEntry';
import {EntrySequence} from '../EntrySequence';
import {SoftButton} from '../SoftButton';

export type MultipleChoiceActivityProps = {
  content: MultipleChoiceContent;
  onComplete: (reports: EntryReport[]) => void;
};

/** Each question: the prompt (VI, optional EN) and its options. */
export function MultipleChoiceActivity({
  content,
  onComplete,
}: MultipleChoiceActivityProps) {
  return (
    <EntrySequence
      count={content.questions.length}
      onComplete={onComplete}
      renderEntry={(index, report) => {
        const question = content.questions[index]!;
        return (
          <>
            <QuestionCard
              promptEn={question.promptEn}
              promptVi={question.promptVi}
            />
            <ChoiceEntry
              onReport={report}
              options={question.options}
              rightId={question.correctOptionId}
            />
          </>
        );
      }}
    />
  );
}

/** The question on a white card; an English line can be heard. */
function QuestionCard({
  promptVi,
  promptEn,
}: {
  promptVi: string;
  promptEn?: string | null;
}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const speak = useScreenSpeak();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.card}>
      <View style={styles.text}>
        <AppText testID="lesson-flow-prompt" variant="h3">
          {promptVi}
        </AppText>
        {promptEn ? <AppText color="secondary">{promptEn}</AppText> : null}
      </View>
      {promptEn ? (
        <SoftButton
          accessibilityHint={t('lessonFlow.listen_model_hint')}
          icon="volume_up"
          iconOnly
          label={t('lessonFlow.listen_line')}
          onPress={() => {
            speak(promptEn);
          }}
          testID="lesson-flow-prompt-listen"
        />
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      ...studyCardStyle(theme),
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.md,
      padding: theme.spacing.md,
    },
    text: {
      flex: 1,
      gap: 2,
    },
  });
}
