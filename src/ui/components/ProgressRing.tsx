import React from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Circle} from 'react-native-svg';

import {useAppTheme} from '../theme';
import {AppText} from './AppText';

type Props = {
  /** 0..1 */
  progress: number;
  /** Big text in the middle (e.g. "80%"). */
  value: string;
  /** Small text under the value (e.g. "đã nhớ"). */
  caption?: string;
  size?: number;
  strokeWidth?: number;
  accessibilityLabel?: string;
  testID?: string;
};

/** Circular progress with a centered value, used in session summaries. */
export function ProgressRing({
  progress,
  value,
  caption,
  size = 168,
  strokeWidth = 14,
  accessibilityLabel,
  testID,
}: Props) {
  const {theme} = useAppTheme();
  const clamped = Math.min(Math.max(progress, 0), 1);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? value}
      accessibilityRole="progressbar"
      accessibilityValue={{min: 0, max: 100, now: Math.round(clamped * 100)}}
      style={{width: size, height: size}}
      testID={testID}
    >
      <Svg height={size} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={theme.colors.surfaceHigh}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
          stroke={theme.colors.primary}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clamped)}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
      </Svg>
      <View style={styles.center}>
        <AppText variant="h1">{value}</AppText>
        {caption ? (
          <AppText color="secondary" variant="label">
            {caption}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
