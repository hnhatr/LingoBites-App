import React from 'react';
import {View} from 'react-native';
import type {DimensionValue} from 'react-native';
import {AppText} from './AppText';
import {useAppTheme} from '../theme';

type Props = {
  progress: number;
  label: string;
};

export function HandoffProgressTrack({progress, label}: Props) {
  const {theme} = useAppTheme();
  const progressPercent = Math.round(Math.min(Math.max(progress, 0), 1) * 100);
  const width = `${progressPercent}%` as DimensionValue;

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      accessibilityValue={{min: 0, max: 100, now: progressPercent}}
      style={{alignItems: 'center', flexDirection: 'row', gap: 12}}
    >
      <View
        style={{
          backgroundColor: theme.colors.surfaceHigh,
          borderRadius: theme.radius.pill,
          flex: 1,
          height: 12,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radius.pill,
            elevation: 2,
            height: '100%',
            shadowColor: theme.colors.primary,
            shadowOffset: {width: 0, height: 0},
            shadowOpacity: 0.45,
            shadowRadius: 14,
            width,
          }}
        />
      </View>
      <AppText color="secondary" variant="caption">
        {label}
      </AppText>
    </View>
  );
}
