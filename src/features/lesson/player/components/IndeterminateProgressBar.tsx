import React, {useEffect, useState} from 'react';
import {type LayoutChangeEvent, StyleSheet, View} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import {useAppTheme} from '@ui/theme';

const BAR_HEIGHT = 6;
export const SEGMENT_RATIO = 0.4;
const LOOP_MS = 1600;

type Props = {
  testID?: string;
};

/** Travel range for the indeterminate segment from measured track width W. */
export function indeterminateProgressTravelRange(trackWidth: number): {
  start: number;
  end: number;
} {
  'worklet';
  return {
    start: -SEGMENT_RATIO * trackWidth,
    end: trackWidth,
  };
}

export function indeterminateProgressTranslateX(
  progress: number,
  trackWidth: number,
): number {
  'worklet';
  if (trackWidth <= 0) {
    return 0;
  }
  const {start, end} = indeterminateProgressTravelRange(trackWidth);
  return start + progress * (end - start);
}

/**
 * Indeterminate creation progress (FR-002, NFR-002): loops until reduce motion
 * is enabled, then shows a static filled segment.
 */
export function IndeterminateProgressBar({testID}: Props) {
  const {theme} = useAppTheme();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const trackWidth = useSharedValue(0);
  const [trackWidthPx, setTrackWidthPx] = useState(0);

  const handleTrackLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setTrackWidthPx(width);
    trackWidth.value = width;
  };

  useEffect(() => {
    if (reducedMotion) {
      if (typeof cancelAnimation === 'function') {
        cancelAnimation(progress);
      }
      progress.value = 0;
      return;
    }
    if (trackWidthPx <= 0) {
      if (typeof cancelAnimation === 'function') {
        cancelAnimation(progress);
      }
      progress.value = 0;
      return;
    }
    progress.value = 0;
    const timing = withTiming(1, {
      duration: LOOP_MS,
      easing: Easing.inOut(Easing.ease),
    });
    progress.value =
      typeof withRepeat === 'function' ? withRepeat(timing, -1, false) : timing;
    return () => {
      if (typeof cancelAnimation === 'function') {
        cancelAnimation(progress);
      }
    };
  }, [progress, reducedMotion, trackWidthPx]);

  const segmentStyle = useAnimatedStyle(() => {
    if (reducedMotion) {
      return {transform: [{translateX: 0}]};
    }
    const w = trackWidth.value;
    if (w <= 0) {
      return {transform: [{translateX: 0}]};
    }
    const translateX = indeterminateProgressTranslateX(progress.value, w);
    return {
      transform: [{translateX}],
    };
  });

  return (
    <View
      accessibilityRole="progressbar"
      onLayout={handleTrackLayout}
      style={[
        styles.track,
        {
          backgroundColor: theme.colors.surfaceHigh,
          borderRadius: BAR_HEIGHT / 2,
        },
      ]}
      testID={testID}
    >
      <Animated.View
        style={[
          styles.segment,
          {
            backgroundColor: theme.colors.primary,
            borderRadius: BAR_HEIGHT / 2,
            width: `${SEGMENT_RATIO * 100}%`,
          },
          segmentStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    height: BAR_HEIGHT,
  },
  track: {
    height: BAR_HEIGHT,
    overflow: 'hidden',
    width: '100%',
  },
});
