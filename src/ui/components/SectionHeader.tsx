import React from 'react';
import {View} from 'react-native';
import {useAppTheme} from '../theme';
import {AppText} from './AppText';

type Props = {
  title: string;
  action?: React.ReactNode;
};

export function SectionHeader({title, action}: Props) {
  const {theme} = useAppTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: theme.spacing.sm,
      }}
    >
      <AppText variant="h3">{title}</AppText>
      {action}
    </View>
  );
}
