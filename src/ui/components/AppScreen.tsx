import React from 'react';
import {StyleSheet, View, type ViewProps} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAppTheme} from '../theme';

export function AppScreen({style, children, ...rest}: ViewProps) {
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
      <View style={styles.fill}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: {flex: 1},
});
