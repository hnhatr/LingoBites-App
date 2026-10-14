import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerFace, isStickerTheme} from '@ui/theme/hardShadow';

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
 * The six steps as one segmented bar: done steps filled, the open step
 * highlighted. Every segment opens its step, like the old step chips.
 */
export function FlowProgressBar({
  step,
  doneSteps,
  skippedSteps,
  onSelect,
}: FlowProgressBarProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{
        text: t('lessonFlow.progress_a11y', {step, total: FLOW_STEPS.length}),
      }}
      style={themedStyles.row}
      testID="lesson-flow-progress"
    >
      {FLOW_STEPS.map(value => {
        const skipped = skippedSteps?.has(value) ?? false;
        const fill =
          value === step
            ? themedStyles.current
            : doneSteps.has(value)
            ? themedStyles.done
            : skipped
            ? themedStyles.skipped
            : themedStyles.upcoming;
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
              disabled: skipped && value !== step,
            }}
            disabled={skipped && value !== step}
            key={value}
            onPress={() => onSelect(value)}
            style={themedStyles.hit}
            testID={`lesson-flow-step-${value}`}
          >
            <View style={[themedStyles.segment, fill]} />
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  const sticker = isStickerTheme(theme);
  return StyleSheet.create({
    current: {
      backgroundColor: theme.colors.accent,
      ...getStickerFace(theme, 0, 1.5),
    },
    done: {
      backgroundColor: theme.colors.primary,
    },
    hit: {
      flex: 1,
      justifyContent: 'center',
      minHeight: 44,
    },
    row: {
      flex: 1,
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    segment: {
      borderRadius: theme.radius.pill,
      height: sticker ? 12 : 10,
    },
    skipped: {
      backgroundColor: theme.colors.accentSoft,
    },
    upcoming: {
      backgroundColor: theme.colors.surfaceHigh,
    },
  });
}
