import React from 'react';
import {Pressable, type StyleProp, type ViewStyle} from 'react-native';

import type {HandoffIconName} from '../icons/iconRegistry';
import {useAppTheme} from '../theme';
import type {AppTheme} from '../theme/types';
import {MaterialIcon} from './MaterialIcon';

export type IconButtonTone =
  | 'accent'
  | 'coral'
  | 'ghost'
  | 'surface'
  | 'danger'
  | 'tertiary'
  | 'bare';

type Props = {
  icon: HandoffIconName;
  accessibilityLabel: string;
  accessibilityHint?: string;
  tone?: IconButtonTone;
  size?: number;
  iconSize?: number;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function resolveTone(
  theme: AppTheme,
  tone: IconButtonTone,
): {background: string; icon: string} {
  switch (tone) {
    case 'accent':
      return {background: theme.colors.accent, icon: theme.colors.accentInk};
    case 'coral':
      return {
        background: theme.colors.secondaryContainer,
        icon: theme.colors.text.inverse,
      };
    case 'ghost':
      return {background: theme.colors.surfaceHigh, icon: theme.colors.primary};
    case 'danger':
      return {background: theme.colors.surfaceHigh, icon: theme.colors.danger};
    case 'tertiary':
      return {
        background: theme.colors.tertiaryFixed,
        icon: theme.colors.onTertiaryContainer,
      };
    case 'bare':
      return {background: 'transparent', icon: theme.colors.primary};
    default:
      return {background: theme.colors.surfaceHigh, icon: theme.colors.primary};
  }
}

export function IconButton({
  icon,
  accessibilityLabel,
  accessibilityHint,
  tone = 'surface',
  size = 40,
  iconSize = 22,
  onPress,
  disabled = false,
  style,
  testID,
}: Props) {
  const {theme} = useAppTheme();
  const colors = resolveTone(theme, tone);
  const isInteractive = typeof onPress === 'function';
  const targetSize = Math.max(size, 44);

  const buttonStyle: ViewStyle = {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: theme.radius.pill,
    height: targetSize,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
    opacity: disabled ? theme.states.disabledOpacity : 1,
    width: targetSize,
  };

  const iconNode = (
    <MaterialIcon color={colors.icon} name={icon} size={iconSize} />
  );

  if (!isInteractive) {
    return iconNode;
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({pressed}) => [
        buttonStyle,
        style,
        pressed && !disabled && {opacity: theme.states.pressedOpacity},
      ]}
    >
      {iconNode}
    </Pressable>
  );
}
