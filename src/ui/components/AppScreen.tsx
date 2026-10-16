import React from 'react';
import {StyleSheet, View, type ViewProps} from 'react-native';
import {
  type Edge,
  SafeAreaInsetsContext,
  SafeAreaView,
} from 'react-native-safe-area-context';

import {useAppTheme} from '../theme';
import {OfflineBanner} from './OfflineBanner';

type Props = ViewProps & {
  /** Screens that explain being offline themselves (boot gate) opt out. */
  showOfflineBanner?: boolean;
  /**
   * Safe-area edges to pad (default: all). Screens whose picture runs under
   * the status bar leave out `top`; the offline strip then clears it itself.
   */
  edges?: readonly Edge[];
  /** The screen shows a copy saved on the device ("Đã tải" on the bar). */
  offlineCopy?: boolean;
};

export function AppScreen({
  style,
  children,
  showOfflineBanner = true,
  edges,
  offlineCopy = false,
  ...rest
}: Props) {
  const {theme} = useAppTheme();
  const insets = React.useContext(SafeAreaInsetsContext);
  const padsTop = !edges || edges.includes('top');
  return (
    <SafeAreaView
      style={StyleSheet.flatten([
        styles.fill,
        {backgroundColor: theme.colors.background},
        style,
      ])}
      edges={edges}
      {...rest}
    >
      {showOfflineBanner ? (
        <OfflineBanner
          downloaded={offlineCopy}
          topInset={padsTop ? 0 : (insets?.top ?? 0)}
        />
      ) : null}
      <View style={styles.fill}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: {flex: 1},
});
