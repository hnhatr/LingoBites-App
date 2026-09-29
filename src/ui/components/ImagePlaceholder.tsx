import React from 'react';
import {View} from 'react-native';
import {AppText} from './AppText';
import {useAppTheme} from '../theme';

type Props = {
  label?: string;
  height?: number;
};

export function ImagePlaceholder({label = 'Ảnh', height = 180}: Props) {
  const {theme} = useAppTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.surfaceMuted,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.lg,
        borderStyle: 'dashed',
        borderWidth: 1,
        height,
        justifyContent: 'center',
      }}
    >
      <AppText color="muted">{label}</AppText>
    </View>
  );
}
