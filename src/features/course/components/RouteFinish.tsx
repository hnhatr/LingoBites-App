import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

type Props = {
  title: string;
  body: string;
  /** Width of the route rail, so the marker sits on the line. */
  railWidth: number;
  testID?: string;
};

/** The flag that ends a route of units. */
export function RouteFinish({title, body, railWidth, testID}: Props) {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.row} testID={testID}>
      <View style={[styles.rail, {width: railWidth}]}>
        <View style={themedStyles.flag}>
          <MaterialIcon
            color={theme.colors.onTertiaryContainer}
            name="flag"
            size={22}
          />
        </View>
      </View>
      <View style={styles.copy}>
        <AppText variant="label">{title}</AppText>
        <AppText color="muted" variant="caption">
          {body}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  copy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rail: {
    alignItems: 'center',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    flag: {
      alignItems: 'center',
      backgroundColor: theme.colors.tertiaryContainer,
      borderRadius: 14,
      height: 44,
      justifyContent: 'center',
      transform: [{rotate: '-6deg'}],
      width: 44,
    },
  });
}
