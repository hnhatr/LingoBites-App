import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

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
    affirmative: theme.colors.accent,
    negative: HERO_PALETTE.coral,
    question: HERO_PALETTE.sun,
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
            <View style={[styles.tag, {backgroundColor: colorOf[polarity]}]} />
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
                  value === 0 && themedStyles.stepOff,
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
                  total + step > max && themedStyles.stepOff,
                ]}
                testID={`combo-setup-mix-more-${polarity}`}
              >
                <AppText style={themedStyles.stepGlyph}>+</AppText>
              </Pressable>
            </View>
          </View>
        );
      })}
      <View style={styles.total}>
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
          color="secondary"
          testID="combo-setup-mix-total"
          variant="caption"
        >
          {t('combo.setup.mix_total', {count: total, max})}
        </AppText>
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
  tag: {
    borderRadius: 4,
    height: 30,
    width: 8,
  },
  total: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingTop: 4,
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
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 4,
      flex: 1,
      flexDirection: 'row',
      height: 8,
      overflow: 'hidden',
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      gap: theme.spacing.sm,
      paddingBottom: 12,
      paddingHorizontal: 14,
      paddingTop: 4,
      ...getStickerEdge(3, theme.colors.surfaceHigh),
    },
    name: {
      fontWeight: theme.typography.weight.bold,
    },
    preset: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    row: {
      alignItems: 'center',
      borderBottomColor: theme.colors.surfaceHigh,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 10,
      paddingVertical: 10,
    },
    stepButton: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 11,
      height: 32,
      justifyContent: 'center',
      width: 32,
      ...getStickerEdge(2, theme.colors.surfaceHigh),
    },
    stepOff: {
      backgroundColor: theme.colors.surfaceMuted,
      borderBottomWidth: 0,
      opacity: theme.states.disabledOpacity,
      shadowOpacity: 0,
    },
    stepGlyph: {
      color: theme.colors.primary,
      fontSize: 18,
      fontWeight: theme.typography.weight.bold,
      lineHeight: 22,
    },
    stepper: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 14,
      flexDirection: 'row',
      gap: 2,
      padding: 3,
    },
  });
}
