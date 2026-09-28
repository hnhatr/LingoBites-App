import React from 'react';
import {StyleSheet, Text, type TextProps} from 'react-native';
import {useAppTheme} from '../theme';

type Variant =
  | 'title'
  | 'subtitle'
  | 'body'
  | 'caption'
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bodyLg'
  | 'label';
type ColorToken = 'primary' | 'secondary' | 'muted' | 'inverse' | 'danger';

type Props = TextProps & {
  variant?: Variant;
  color?: ColorToken;
};

type TypographyPresetKey = keyof ReturnType<
  typeof useAppTheme
>['theme']['typography']['presets'];

export function AppText({
  variant = 'body',
  color = 'primary',
  style,
  maxFontSizeMultiplier,
  ...rest
}: Props) {
  const {theme} = useAppTheme();
  const preset = theme.typography.presets[variant as TypographyPresetKey];
  const variantStyle = {
    fontSize: preset.fontSize,
    lineHeight: preset.lineHeight,
    fontWeight: preset.fontWeight,
  };

  const colorValue =
    color === 'danger' ? theme.colors.danger : theme.colors.text[color];

  const isDisplay = [
    'display',
    'h1',
    'h2',
    'h3',
    'title',
    'label',
    'caption',
  ].includes(variant);
  const resolvedFontFamily = isDisplay
    ? theme.typography.fontFamily.display
    : theme.typography.fontFamily.primary;

  return (
    <Text
      maxFontSizeMultiplier={
        maxFontSizeMultiplier ?? preset.maxFontSizeMultiplier
      }
      style={StyleSheet.flatten([
        {color: colorValue, fontFamily: resolvedFontFamily},
        variantStyle,
        style,
      ])}
      {...rest}
    />
  );
}
