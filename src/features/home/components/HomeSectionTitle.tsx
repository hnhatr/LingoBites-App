/**
 * HomeSectionTitle — shared heading for the Home plan and weekly-goal cards,
 * so the cards below the hero read as one system.
 */
import React, {useMemo} from 'react';
import {StyleSheet} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

type Props = {
  title: string;
};

export function HomeSectionTitle({title}: Props) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <AppText accessibilityRole="header" style={styles.title}>
      {title}
    </AppText>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    title: {
      color: theme.colors.text.primary,
      fontSize: 15,
      fontWeight: '800',
    },
  });
}
