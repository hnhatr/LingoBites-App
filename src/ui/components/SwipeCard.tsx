import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  Animated,
  PanResponder,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';

import {useAppTheme} from '../theme';
import type {AppTheme} from '../theme/types';
import {AppText} from './AppText';

export type SwipeDirection = 'left' | 'right';

export interface SwipeCardProps {
  children: React.ReactNode;
  /** Swipes are ignored (the card stays put) while false. */
  enabled: boolean;
  onSwipe: (direction: SwipeDirection) => void;
  /** Stamp shown while dragging left (e.g. "Quên"). */
  leftLabel: string;
  /** Stamp shown while dragging right (e.g. "Nhớ"). */
  rightLabel: string;
  /** Changing it plays the entrance animation (next card). */
  cardKey?: string;
  style?: ViewStyle;
  testID?: string;
}

const SWIPE_THRESHOLD = 110;
const SWIPE_VELOCITY = 0.8;

/**
 * Tinder-style swipe wrapper: drag right / left past the threshold to commit.
 * Taps still reach the child (the pan only claims clear horizontal drags), and
 * every swipe has an equivalent button on screen for assistive tech.
 */
export function SwipeCard({
  children,
  enabled,
  onSwipe,
  leftLabel,
  rightLabel,
  cardKey,
  style,
  testID = 'swipe-card',
}: SwipeCardProps) {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const {width} = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);
  const dragX = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => sub.remove();
  }, []);

  // Next card: rise in from slightly below instead of popping into place.
  useEffect(() => {
    dragX.setValue(0);
    if (reduceMotion) {
      enter.setValue(1);
      return;
    }
    enter.setValue(0);
    Animated.spring(enter, {
      toValue: 1,
      friction: 7,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [cardKey, dragX, enter, reduceMotion]);

  // The responder is created once; read the latest props through a ref.
  const latest = useRef({enabled, onSwipe, reduceMotion, width});
  latest.current = {enabled, onSwipe, reduceMotion, width};

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          latest.current.enabled &&
          Math.abs(g.dx) > 10 &&
          Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderMove: (_e, g) => dragX.setValue(g.dx),
        onPanResponderRelease: (_e, g) => {
          const commit =
            Math.abs(g.dx) > SWIPE_THRESHOLD || Math.abs(g.vx) > SWIPE_VELOCITY;
          if (!commit || !latest.current.enabled) {
            Animated.spring(dragX, {
              toValue: 0,
              friction: 6,
              useNativeDriver: true,
            }).start();
            return;
          }
          const direction: SwipeDirection = g.dx > 0 ? 'right' : 'left';
          if (latest.current.reduceMotion) {
            dragX.setValue(0);
            latest.current.onSwipe(direction);
            return;
          }
          Animated.timing(dragX, {
            toValue: (direction === 'right' ? 1 : -1) * latest.current.width,
            duration: 180,
            useNativeDriver: true,
          }).start(() => latest.current.onSwipe(direction));
        },
        onPanResponderTerminate: () => {
          Animated.spring(dragX, {toValue: 0, useNativeDriver: true}).start();
        },
      }),
    [dragX],
  );

  const rotate = dragX.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ['-12deg', '0deg', '12deg'],
  });
  const rightOpacity = dragX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const leftOpacity = dragX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const translateY = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
  });

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        style,
        {
          opacity: enter,
          transform: [{translateX: dragX}, {translateY}, {rotate}],
        },
      ]}
      testID={testID}
    >
      {children}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      >
        <Animated.View
          style={[
            themedStyles.stamp,
            themedStyles.stampRight,
            {opacity: rightOpacity},
          ]}
        >
          <AppText style={themedStyles.stampRightText} variant="h3">
            {rightLabel}
          </AppText>
        </Animated.View>
        <Animated.View
          style={[
            themedStyles.stamp,
            themedStyles.stampLeft,
            {opacity: leftOpacity},
          ]}
        >
          <AppText style={themedStyles.stampLeftText} variant="h3">
            {leftLabel}
          </AppText>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    stamp: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      borderWidth: 3,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      position: 'absolute',
      top: theme.spacing.lg,
    },
    stampLeft: {
      borderColor: theme.colors.danger,
      right: theme.spacing.lg,
      transform: [{rotate: '12deg'}],
    },
    stampLeftText: {
      color: theme.colors.danger,
    },
    stampRight: {
      borderColor: theme.colors.primary,
      left: theme.spacing.lg,
      transform: [{rotate: '-12deg'}],
    },
    stampRightText: {
      color: theme.colors.primary,
    },
  });
}
