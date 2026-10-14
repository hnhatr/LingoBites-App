import React from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Line} from 'react-native-svg';

import {useAppTheme} from '@ui/theme';

type Props = {
  /** Solid primary for the part of the route already travelled. */
  done?: boolean;
  /** How far the line runs past its row, to reach the next stop. */
  overhang: number;
};

/** The vertical line joining one route stop to the next. */
export function RouteLine({done = false, overhang}: Props) {
  const {theme} = useAppTheme();
  return (
    <View pointerEvents="none" style={[styles.line, {marginBottom: -overhang}]}>
      <Svg height="100%" style={StyleSheet.absoluteFill} width={4}>
        <Line
          stroke={done ? theme.colors.primary : theme.colors.outlineVariant}
          strokeDasharray={done ? undefined : '6 6'}
          strokeLinecap="round"
          strokeWidth={3}
          x1={2}
          x2={2}
          y1={2}
          y2="100%"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    alignSelf: 'center',
    flex: 1,
    minHeight: 12,
    width: 4,
  },
});
