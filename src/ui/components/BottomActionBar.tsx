import React from 'react';
import {View, type ViewProps} from 'react-native';
import {useAppTheme} from '../theme';

export function BottomActionBar({style, children, ...rest}: ViewProps) {
  const {theme} = useAppTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          gap: theme.spacing.sm,
          paddingHorizontal: theme.gutter,
          paddingVertical: theme.spacing.md,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
