import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {useScreenSpeak} from '@features/audio';

import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {MaterialIcon} from '@ui/components/MaterialIcon';
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
 * entry's support level (decision G2). Redesign: one compact "Kẹt?" row
 * with a dot per level, the opened levels listed above it.
 */
export function HintLadder({
  steps,
  onSupportChange,
  disabled = false,
}: HintLadderProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const speak = useScreenSpeak();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [opened, setOpened] = useState(0);
  if (steps.length === 0) return null;

  const open = () => {
    const step = steps[opened];
    if (!step) return;
    const next = opened + 1;
    setOpened(next);
    if (step.speak) {
      speak(step.speak);
    }
    onSupportChange(supportLevelOf(steps.slice(0, next)));
  };

  return (
    <View style={themedStyles.container}>
      {opened > 0 ? (
        <View style={themedStyles.opened}>
          {steps.slice(0, opened).map(step => (
            <AppText key={step.level} testID={`lesson-flow-hint-${step.level}`}>
              <AppText color="secondary" variant="label">
                {t(TYPE_LABEL_KEYS[step.type])}:{' '}
              </AppText>
              {step.text}
            </AppText>
          ))}
        </View>
      ) : null}
      {opened < steps.length ? (
        <View style={themedStyles.row}>
          <MaterialIcon
            color={theme.colors.tertiary}
            name="lightbulb"
            size={20}
          />
          <AppText color="secondary" style={themedStyles.flex} variant="label">
            {t('lessonFlow.hint_stuck')}
          </AppText>
          <View style={themedStyles.dots}>
            {steps.map(step => (
              <View
                key={step.level}
                style={[
                  themedStyles.dot,
                  step.level <= opened ? themedStyles.dotOpen : null,
                ]}
              />
            ))}
          </View>
          {disabled ? null : (
            <Chip
              accessibilityHint={t('lessonFlow.hint_hint')}
              label={t('lessonFlow.hint', {opened, total: steps.length})}
              onPress={open}
              testID="lesson-flow-hint"
              tone="gold"
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  const {colors} = theme;
  return StyleSheet.create({
    container: {
      gap: theme.spacing.sm,
    },
    dot: {
      backgroundColor: colors.outlineVariant,
      borderRadius: theme.radius.pill,
      height: 8,
      width: 8,
    },
    dotOpen: {
      backgroundColor: colors.tertiary,
    },
    dots: {
      flexDirection: 'row',
      gap: 3,
    },
    flex: {
      flex: 1,
    },
    opened: {
      backgroundColor: colors.tertiarySoft,
      borderRadius: theme.radius.md,
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
    },
    row: {
      alignItems: 'center',
      borderColor: colors.outlineVariant,
      borderRadius: theme.radius.lg,
      borderStyle: 'dashed',
      borderWidth: 1.5,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingLeft: theme.spacing.md,
      paddingRight: theme.spacing.xs,
    },
  });
}
