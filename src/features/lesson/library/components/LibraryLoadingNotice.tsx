import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

const BAR_HEIGHT = 6;

export interface LibraryLoadingNoticeProps {
  message: string;
  testID?: string;
}

/**
 * Indeterminate loading bar with a message, shown while local data is read so
 * the screen never looks frozen. The bar runs on the native driver, so it
 * keeps moving even while the JS thread is busy.
 */
export function LibraryLoadingNotice({
  message,
  testID = 'library-loading',
}: LibraryLoadingNoticeProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [trackWidth, setTrackWidth] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const segment = trackWidth * 0.4;
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-segment, trackWidth],
  });

  return (
    <View
      accessibilityLabel={message}
      accessibilityRole="progressbar"
      accessibilityLiveRegion="polite"
      style={styles.container}
      testID={testID}
    >
      <AppText variant="label" color="secondary">
        {message}
      </AppText>
      <View
        style={styles.track}
        onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
      >
        <Animated.View
          style={[styles.bar, {width: segment, transform: [{translateX}]}]}
        />
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.md,
    },
    track: {
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.pill,
      height: BAR_HEIGHT,
      overflow: 'hidden',
    },
    bar: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
      height: BAR_HEIGHT,
    },
  });
}
