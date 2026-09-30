import React from 'react';
import type {StyleProp, TextStyle} from 'react-native';
import Animated, {type AnimatedStyle} from 'react-native-reanimated';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import {
  type HandoffIconName,
  isValidMaterialIconGlyph,
  resolveHandoffIconName,
} from '../icons/iconRegistry';
import {useAppTheme} from '../theme';

const AnimatedMaterialIcons = Animated.createAnimatedComponent(MaterialIcons);

type Props = {
  name: HandoffIconName;
  size?: number;
  color?: string;
};

type AnimatedProps = {
  name: HandoffIconName;
  size?: number;
  style: AnimatedStyle<StyleProp<TextStyle>>;
};

export function MaterialIcon({name, size = 24, color}: Props) {
  const {theme} = useAppTheme();
  const glyph = resolveHandoffIconName(name);

  if (__DEV__ && !isValidMaterialIconGlyph(glyph)) {
    console.warn(
      `[MaterialIcon] Missing glyph "${glyph}" for handoff icon "${name}".`,
    );
  }

  return (
    <MaterialIcons
      accessibilityElementsHidden
      importantForAccessibility="no"
      name={glyph}
      size={size}
      color={color ?? theme.colors.primary}
    />
  );
}

/** Animated variant for UI-thread color interpolation (e.g. tab crossfade). */
export function AnimatedMaterialIcon({name, size = 24, style}: AnimatedProps) {
  const glyph = resolveHandoffIconName(name);

  if (__DEV__ && !isValidMaterialIconGlyph(glyph)) {
    console.warn(
      `[MaterialIcon] Missing glyph "${glyph}" for handoff icon "${name}".`,
    );
  }

  return (
    <AnimatedMaterialIcons
      accessibilityElementsHidden
      importantForAccessibility="no"
      name={glyph}
      size={size}
      style={style}
    />
  );
}
