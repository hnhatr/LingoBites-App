import React from 'react';
import {View} from 'react-native';
import {AppText} from './AppText';
import {useAppTheme, type AppTheme} from '../theme';

export type MedallionTone = 'teal' | 'coral' | 'gold';

type Props = {
  label: string;
  size?: number;
  tone?: MedallionTone;
};

function medallionColors(theme: AppTheme, tone: MedallionTone) {
  switch (tone) {
    case 'coral':
      return {bg: theme.colors.secondarySoft, fg: theme.colors.secondary};
    case 'gold':
      return {bg: theme.colors.tertiarySoft, fg: theme.colors.tertiary};
    default:
      return {bg: theme.colors.accentSoft, fg: theme.colors.primary};
  }
}

export function Medallion({label, size = 46, tone = 'teal'}: Props) {
  const {theme} = useAppTheme();
  const medallion = medallionColors(theme, tone);
  return (
    <View
      testID="medallion"
      style={{
        alignItems: 'center',
        backgroundColor: medallion.bg,
        borderRadius: 14,
        height: size,
        justifyContent: 'center',
        width: size,
      }}
    >
      <AppText variant="h3" style={{color: medallion.fg, textAlign: 'center'}}>
        {label}
      </AppText>
    </View>
  );
}
