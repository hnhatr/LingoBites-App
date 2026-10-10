import React from 'react';
import {StyleSheet, View, type ViewProps} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useAppTheme} from '../theme';
import {OfflineBanner} from './OfflineBanner';

type Props = ViewProps & {
  /** Screens that explain being offline themselves (boot gate) opt out. */
  showOfflineBanner?: boolean;
};

export function AppScreen({
  style,
  children,
  showOfflineBanner = true,
  ...rest
}: Props) {
  const {theme} = useAppTheme();
  return (
    <SafeAreaView
      style={StyleSheet.flatten([
        styles.fill,
        {backgroundColor: theme.colors.background},
        style,
      ])}
      {...rest}
    >
      {showOfflineBanner ? <OfflineBanner /> : null}
      <View style={styles.fill}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: {flex: 1},
});
