import React from 'react';
import {Pressable, type PressableProps} from 'react-native';

import {useAppTheme} from '../theme';
import {AppText} from './AppText';
import {SvgIcon} from './SvgIcon';

type Props = Pick<PressableProps, 'disabled' | 'onPress' | 'testID'> & {
  accessibilityLabel: string;
  label: string;
};

export function PrimaryActionButton({
  accessibilityLabel,
  disabled = false,
  label,
  onPress,
  testID,
}: Props) {
  const {theme} = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{disabled: disabled ?? false}}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({pressed}) => [
        {
          alignItems: 'center',
          backgroundColor: theme.colors.primary,
          borderRadius: theme.radius.lg,
          flexDirection: 'row',
          gap: 8,
          justifyContent: 'center',
          minHeight: 52,
          opacity: disabled
            ? theme.states.disabledOpacity
            : pressed
            ? theme.states.pressedOpacity
            : 1,
        },
      ]}
    >
      <SvgIcon
        color={theme.colors.text.inverse}
        name="auto_stories"
        size={22}
      />
      <AppText
        style={{
          color: theme.colors.text.inverse,
          fontSize: 18,
          fontWeight: '600',
        }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
