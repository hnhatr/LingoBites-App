import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {Chip} from '@ui/components/Chip';
import {HandoffProgressTrack} from '@ui/components/HandoffProgressTrack';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {FLOW_STEPS, type FlowStep} from '../logic/practiceCompletion';

export type StepRailProps = {
  step: FlowStep;
  /** Steps whose activities all have an attempt (shown with a tick). */
  doneSteps: ReadonlySet<number>;
  onSelect: (step: FlowStep) => void;
};

/** The six steps as chips plus a progress bar; any step can be opened. */
export function StepRail({step, doneSteps, onSelect}: StepRailProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={themedStyles.container} testID="lesson-flow-step-rail">
      <View style={themedStyles.chips}>
        {FLOW_STEPS.map(value => (
          <Chip
            accessibilityHint={t('lessonFlow.step_chip_hint')}
            key={value}
            label={doneSteps.has(value) ? `${value} ✓` : String(value)}
            onPress={() => onSelect(value)}
            selected={value === step}
            testID={`lesson-flow-step-${value}`}
            tone="accent"
          />
        ))}
      </View>
      <HandoffProgressTrack
        label={t('lessonFlow.progress_a11y', {step, total: FLOW_STEPS.length})}
        progress={step / FLOW_STEPS.length}
      />
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    container: {
      gap: theme.spacing.sm,
    },
  });
}
