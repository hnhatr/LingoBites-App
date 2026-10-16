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
 * The six steps as the app's progress notes: done steps mint, the open step
 * coral, skipped ones faded. An invisible button lies over each note, so
 * tapping it opens that step, like the old step chips.
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
        <AppProgressBar
          current={step - 1}
          done={toIndexes(doneSteps)}
          skipped={skippedSteps && toIndexes(skippedSteps)}
          total={FLOW_STEPS.length}
        />
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

/** Steps are numbered from 1; the progress notes count from 0. */
function toIndexes(steps: ReadonlySet<number>): Set<number> {
  return new Set([...steps].map(value => value - 1));
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
