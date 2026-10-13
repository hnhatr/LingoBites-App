import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {ComboPolarity} from '../logic/comboClient';

export type PolarityMix = Partial<Record<ComboPolarity, number>>;

type Props = {
  /** The polarities the plan allows, in the Server's order. */
  polarities: ComboPolarity[];
  mix: PolarityMix;
  /** Each part moves by whole rounds of subjects (the smallest batch size). */
  step: number;
  /** The largest batch the plan allows. */
  max: number;
  onChange: (mix: PolarityMix) => void;
};

export function mixTotal(mix: PolarityMix): number {
  return Object.values(mix).reduce((sum, count) => sum + (count ?? 0), 0);
}

/**
 * Vocab path P5: how many sentences of each polarity the batch has, e.g. 3
 * affirmative, 3 negative and 6 questions. A stepper per polarity, the total
 * against the plan's largest batch, a bar of the mix and a few quick picks.
 */
export function PolarityMixPicker({
  polarities,
  mix,
  step,
  max,
  onChange,
}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const total = mixTotal(mix);
  const colorOf: Record<ComboPolarity, string> = {
    affirmative: theme.colors.primary,
    negative: theme.colors.secondary,
    question: theme.colors.tertiary,
  };

  const even = Math.floor(max / (polarities.length * step)) * step;
  const presets: Array<{key: string; label: string; mix: PolarityMix}> = [
    ...(polarities.length > 1 && even > 0
      ? [
          {
            key: 'even',
            label: t('combo.setup.mix_even', {count: even}),
            mix: Object.fromEntries(polarities.map(p => [p, even])),
          },
        ]
      : []),
    ...polarities.map(polarity => ({
      key: polarity,
      label: t('combo.setup.mix_only', {
        name: t(`combo.setup.polarity_value.${polarity}`),
      }),
      mix: {[polarity]: max},
    })),
  ];

  const hint =
    total === 0
      ? t('combo.setup.mix_empty', {count: step})
      : total === max
      ? t('combo.setup.mix_full', {count: max})
      : t('combo.setup.mix_step', {count: step});

  return (
    <View style={themedStyles.card} testID="combo-setup-mix">
      {polarities.map(polarity => {
        const value = mix[polarity] ?? 0;
        const name = t(`combo.setup.polarity_value.${polarity}`);
        return (
          <View key={polarity} style={themedStyles.row}>
            <View style={[styles.dot, {backgroundColor: colorOf[polarity]}]} />
            <View style={styles.label}>
              <AppText variant="label" style={themedStyles.name}>
                {name}
              </AppText>
              <AppText color="muted" numberOfLines={1} variant="caption">
                {t(`combo.setup.polarity_example.${polarity}`)}
              </AppText>
            </View>
            <View style={themedStyles.stepper}>
              <Pressable
                accessibilityHint={t('combo.setup.mix_less_hint', {
                  count: step,
                })}
                accessibilityLabel={t('combo.setup.mix_less', {name})}
                accessibilityRole="button"
                accessibilityState={{disabled: value === 0}}
                disabled={value === 0}
                onPress={() =>
                  value > 0 && onChange({...mix, [polarity]: value - step})
                }
                style={[
                  themedStyles.stepButton,
                  value === 0 && themedStyles.disabled,
                ]}
                testID={`combo-setup-mix-less-${polarity}`}
              >
                <AppText style={themedStyles.stepGlyph}>−</AppText>
              </Pressable>
              <AppText
                color={value === 0 ? 'muted' : 'primary'}
                style={styles.value}
                testID={`combo-setup-mix-value-${polarity}`}
                variant="label"
              >
                {value}
              </AppText>
              <Pressable
                accessibilityHint={t('combo.setup.mix_more_hint', {
                  count: step,
                })}
                accessibilityLabel={t('combo.setup.mix_more', {name})}
                accessibilityRole="button"
                accessibilityState={{disabled: total + step > max}}
                disabled={total + step > max}
                onPress={() =>
                  total + step <= max &&
                  onChange({...mix, [polarity]: value + step})
                }
                style={[
                  themedStyles.stepButton,
                  total + step > max && themedStyles.disabled,
                ]}
                testID={`combo-setup-mix-more-${polarity}`}
              >
                <AppText style={themedStyles.stepGlyph}>+</AppText>
              </Pressable>
            </View>
          </View>
        );
      })}
      <View style={themedStyles.bar}>
        {polarities.map(polarity =>
          mix[polarity] ? (
            <View
              key={polarity}
              style={{
                backgroundColor: colorOf[polarity],
                flexGrow: mix[polarity],
              }}
            />
          ) : null,
        )}
        {total < max ? <View style={{flexGrow: max - total}} /> : null}
      </View>
      <AppText
        color={total === 0 ? 'danger' : 'muted'}
        testID="combo-setup-mix-hint"
        variant="caption"
      >
        {hint}
      </AppText>
      <View style={styles.presets}>
        {presets.map(preset => (
          <Pressable
            accessibilityHint={t('combo.setup.mix_preset_hint')}
            accessibilityLabel={preset.label}
            accessibilityRole="button"
            key={preset.key}
            onPress={() => onChange(preset.mix)}
            style={themedStyles.preset}
            testID={`combo-setup-mix-preset-${preset.key}`}
          >
            <AppText color="secondary" variant="caption">
              {preset.label}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  label: {
    flex: 1,
    minWidth: 0,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  value: {
    minWidth: 28,
    textAlign: 'center',
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    bar: {
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.sm,
      flexDirection: 'row',
      gap: 2,
      height: 8,
      overflow: 'hidden',
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      gap: theme.spacing.sm,
      paddingBottom: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.xs,
    },
    disabled: {
      opacity: theme.states.disabledOpacity,
    },
    name: {
      fontWeight: theme.typography.weight.bold,
    },
    preset: {
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.radius.pill,
      borderStyle: 'dashed',
      borderWidth: 1,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    row: {
      alignItems: 'center',
      borderBottomColor: theme.colors.surfaceHigh,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
    },
    stepButton: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    stepGlyph: {
      color: theme.colors.primary,
      fontSize: 20,
      fontWeight: theme.typography.weight.bold,
      lineHeight: 24,
    },
    stepper: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceLow,
      borderRadius: theme.radius.md,
      flexDirection: 'row',
      padding: 3,
    },
  });
}
