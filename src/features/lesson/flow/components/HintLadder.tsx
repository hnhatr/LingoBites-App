import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {speak} from '@features/audio';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonSupportLevel} from '@core/schemas/sync';

import {type HintStep, supportLevelOf} from '../logic/hints';

export type HintLadderProps = {
  steps: readonly HintStep[];
  /** The support level of the hints opened so far. */
  onSupportChange: (support: LessonSupportLevel) => void;
  disabled?: boolean;
};

const TYPE_LABEL_KEYS: Record<HintStep['type'], string> = {
  replay: 'lessonFlow.hint_type_replay',
  keyword: 'lessonFlow.hint_type_keyword',
  pattern: 'lessonFlow.hint_type_pattern',
  model: 'lessonFlow.hint_type_model',
  eliminate: 'lessonFlow.hint_type_eliminate',
};

/**
 * "Gợi ý (n/3)": opens one level at a time (decision G1). A level with
 * `speak` reads the model sentence aloud. Every level opened raises the
 * entry's support level (decision G2).
 */
export function HintLadder({
  steps,
  onSupportChange,
  disabled = false,
}: HintLadderProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [opened, setOpened] = useState(0);
  if (steps.length === 0) return null;

  const open = () => {
    const step = steps[opened];
    if (!step) return;
    const next = opened + 1;
    setOpened(next);
    if (step.speak) {
      speak(step.speak).catch(() => undefined);
    }
    onSupportChange(supportLevelOf(steps.slice(0, next)));
  };

  return (
    <View style={themedStyles.container}>
      {steps.slice(0, opened).map(step => (
        <AppText key={step.level} testID={`lesson-flow-hint-${step.level}`}>
          <AppText color="secondary" variant="label">
            {t(TYPE_LABEL_KEYS[step.type])}:{' '}
          </AppText>
          {step.text}
        </AppText>
      ))}
      {opened < steps.length ? (
        <AppButton
          accessibilityHint={t('lessonFlow.hint_hint')}
          disabled={disabled}
          iconLeft="lightbulb"
          onPress={open}
          testID="lesson-flow-hint"
          title={t('lessonFlow.hint', {opened, total: steps.length})}
          variant="ghost"
        />
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      alignItems: 'flex-start',
      gap: theme.spacing.xs,
    },
  });
}
