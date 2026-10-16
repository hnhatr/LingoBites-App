import React from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppProgressBar} from '@ui/components/AppProgressBar';

import {FLOW_STEPS, type FlowStep} from '../logic/practiceCompletion';

export type FlowProgressBarProps = {
  step: FlowStep;
  /** Steps whose activities all have an attempt. */
  doneSteps: ReadonlySet<number>;
  /** Steps with nothing to do (an empty step 1): shown done, not tappable. */
  skippedSteps?: ReadonlySet<number>;
  onSelect: (step: FlowStep) => void;
};

/**
 * The six steps on the app's progress bar, filled up to the open step. Six
 * invisible buttons lie over it, one per step, so tapping a part of the bar
 * opens that step, like the old step chips; skipped steps stay closed.
 */
export function FlowProgressBar({
  step,
  doneSteps,
  skippedSteps,
  onSelect,
}: FlowProgressBarProps) {
  const {t} = useTranslation();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{
        text: t('lessonFlow.progress_a11y', {step, total: FLOW_STEPS.length}),
      }}
      style={styles.row}
      testID="lesson-flow-progress"
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.bar}
      >
        <AppProgressBar value={step / FLOW_STEPS.length} />
      </View>
      {FLOW_STEPS.map(value => {
        const skipped = skippedSteps?.has(value) ?? false;
        const done = doneSteps.has(value);
        return (
          <Pressable
            accessibilityHint={t('lessonFlow.step_chip_hint')}
            accessibilityLabel={t('lessonFlow.step_heading', {
              step: value,
              label: t(`lessonFlow.step_${value}`),
            })}
            accessibilityRole="button"
            accessibilityState={{
              selected: value === step,
              checked: done,
              disabled: skipped && value !== step,
            }}
            disabled={skipped && value !== step}
            key={value}
            onPress={() => onSelect(value)}
            style={styles.hit}
            testID={`lesson-flow-step-${value}`}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
  },
  hit: {
    flex: 1,
    minHeight: 44,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
});
