import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {TileComposer} from '@ui/components/TileComposer';
import {useTileMode} from '@ui/components/useTileMode';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonSupportLevel} from '@core/schemas/sync';

import type {EntryResult} from '../logic/activityOutcome';
import {isAccepted} from '../logic/flowContent';
import type {HintStep} from '../logic/hints';
import {HintLadder} from './HintLadder';

export type TypedEntryProps = {
  /** Normalised accepted answers (`acceptedFor` / `normalizeAnswer`). */
  accepted: readonly string[];
  /** Shown once the entry ends. */
  modelAnswer: string;
  /** Hints for this entry (PR 11); a right answer after one is supported. */
  hints: readonly HintStep[];
  onReport: (result: EntryResult, support: LessonSupportLevel) => void;
  /** Fill-in: the words around the blank, shown in the stage. */
  frame?: {before: string; after: string} | null;
  /** Lesson words for noise tiles and the suggestion strip. */
  vocabulary?: readonly string[];
};

const SUPPORT_ORDER: readonly LessonSupportLevel[] = [
  'none',
  'hint_1',
  'hint_2',
  'model',
];

/** The bulb counts as a first hint (decided with the user). */
function withBulb(
  support: LessonSupportLevel,
  bulbUsed: boolean,
): LessonSupportLevel {
  if (!bulbUsed) return support;
  return SUPPORT_ORDER.indexOf(support) >= SUPPORT_ORDER.indexOf('hint_1')
    ? support
    : 'hint_1';
}

/**
 * Write the answer in English with the tile keyboard (TileComposer). It is checked like on the Server (decision
 * G9); a wrong answer can be corrected, which then counts as a retry. The
 * typed text never leaves this component.
 */
export function TypedEntry({
  accepted,
  modelAnswer,
  hints,
  onReport,
  frame = null,
  vocabulary,
}: TypedEntryProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [value, setValue] = useState('');
  const [wrongTries, setWrongTries] = useState(0);
  const [finished, setFinished] = useState<'right' | 'shown' | null>(null);
  const [ladderSupport, setSupport] = useState<LessonSupportLevel>('none');
  const [bulbUsed, setBulbUsed] = useState(false);
  const [wrongValue, setWrongValue] = useState<string | null>(null);
  const [mode, setMode] = useTileMode();
  const support = withBulb(ladderSupport, bulbUsed);

  const check = () => {
    if (finished || value.trim() === '') return;
    if (isAccepted(value, accepted)) {
      setFinished('right');
      onReport(wrongTries === 0 ? 'first_try' : 'after_retry', support);
    } else {
      setWrongTries(tries => tries + 1);
      setWrongValue(value);
    }
  };

  return (
    <View style={themedStyles.container}>
      <TileComposer
        accessibilityHint={t('lessonFlow.answer_hint')}
        accessibilityLabel={t('lessonFlow.answer_label')}
        answer={modelAnswer}
        editable={finished === null}
        frame={frame}
        mode={mode}
        modes={frame ? ['letters', 'keyboard'] : undefined}
        onChangeText={setValue}
        onHint={() => setBulbUsed(true)}
        onModeChange={setMode}
        seed={modelAnswer}
        status={
          finished === 'right'
            ? 'right'
            : finished === null && wrongValue === value
              ? 'wrong'
              : null
        }
        testID="lesson-flow-answer-input"
        value={value}
        vocabulary={vocabulary}
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
              onReport('not_yet', support);
            }}
            testID="lesson-flow-show-answer"
            title={t('lessonFlow.show_answer')}
            variant="ghost"
          />
        </View>
      ) : null}
      <HintLadder
        disabled={finished !== null}
        onSupportChange={setSupport}
        steps={hints}
      />
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
