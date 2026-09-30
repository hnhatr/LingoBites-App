import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import {useAppTheme} from '../theme';
import type {AppTheme} from '../theme/types';
import {AppText} from './AppText';

export type ChipTone =
  | 'default'
  | 'primary'
  | 'accent'
  | 'accentSoft'
  | 'coralSoft'
  | 'gold'
  | 'neutral';

type Props = {
  label: string;
  selected?: boolean;
  tone?: ChipTone;
  onPress?: () => void;
  testID?: string;
  accessibilityHint?: string;
};

type ChipStyle = {background: string; text: string; border: string};

function resolveTone(theme: AppTheme, tone: ChipTone): ChipStyle {
  const {colors} = theme;
  switch (tone) {
    case 'primary':
      return {
        background: colors.primary,
        text: colors.text.inverse,
        border: colors.primary,
      };
    case 'accent':
      return {
        background: colors.accent,
        text: colors.accentInk,
        border: colors.accent,
      };
    case 'accentSoft':
      return {
        background: colors.accentSoft,
        text: colors.primary,
        border: colors.accentSoft,
      };
    case 'coralSoft':
      return {
        background: colors.secondarySoft,
        text: colors.secondary,
        border: colors.secondarySoft,
      };
    case 'gold':
      return {
        background: colors.tertiaryFixed,
        text: colors.onTertiaryContainer,
        border: colors.tertiaryFixed,
      };
    case 'neutral':
      return {
        background: colors.surfaceHigh,
        text: colors.text.secondary,
        border: colors.surfaceHigh,
      };
    default:
      return {
        background: colors.surface,
        text: colors.text.secondary,
        border: colors.border,
      };
  }
}

export function Chip({
  label,
  selected = false,
  tone = 'default',
  onPress,
  testID,
  accessibilityHint,
}: Props) {
  const {theme} = useAppTheme();
  // `selected` keeps the existing filter-chip behavior and wins over `tone`.
  const style = selected
    ? resolveTone(theme, 'primary')
    : resolveTone(theme, tone);

  const inner = (
    <View
      style={{
        backgroundColor: style.background,
        borderColor: style.border,
        borderRadius: theme.radius.pill,
        borderWidth: 1,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
      }}
    >
      <AppText
        variant="label"
        style={{color: style.text, fontWeight: theme.typography.weight.medium}}
      >
        {label}
      </AppText>
    </View>
  );

  if (!onPress) {
    return inner;
  }

  return (
    <Pressable
      accessibilityHint={accessibilityHint ?? 'Chạm để chọn'}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{selected}}
      onPress={onPress}
      style={styles.pressable}
      testID={testID}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    justifyContent: 'center',
    minHeight: 44,
  },
});
