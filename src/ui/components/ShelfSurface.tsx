import React, {useEffect, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  Animated,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import {useAppTheme} from '../theme';

interface ShelfSurfaceProps {
  shelfHeight?: number;
  shelfColor?: string;
  borderRadius?: number;
  isPressed?: boolean;
  isDisabled?: boolean;
  preserveShelfSpace?: boolean; // e.g. for loading state where we keep shelf
  children: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  containerTestID?: string;
  faceStyle?: StyleProp<ViewStyle>;
  faceTestID?: string;
}

export function ShelfSurface({
  shelfHeight = 0,
  shelfColor,
  borderRadius = 0,
  isPressed = false,
  isDisabled = false,
  preserveShelfSpace = false,
  children,
  containerStyle,
  containerTestID,
  faceStyle,
  faceTestID,
}: ShelfSurfaceProps) {
  const {theme} = useAppTheme();
  const [reduceMotion, setReduceMotion] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!shelfHeight || isDisabled || reduceMotion) {
      translateY.setValue(0);
      return;
    }

    Animated.timing(translateY, {
      toValue: isPressed ? shelfHeight - 2 : 0,
      duration: isPressed ? 90 : 120,
      useNativeDriver: true,
    }).start();
  }, [isPressed, shelfHeight, isDisabled, reduceMotion, translateY]);

  const hasShelf = shelfHeight > 0 && shelfColor;
  const showShelf = hasShelf && (!isDisabled || preserveShelfSpace);
  const opacity =
    isDisabled && !preserveShelfSpace
      ? theme.states.disabledOpacity
      : isPressed && reduceMotion
      ? theme.states.pressedOpacity
      : 1;

  return (
    <View
      testID={containerTestID}
      style={[
        containerStyle,
        {
          paddingBottom: showShelf ? shelfHeight : 0,
          marginTop: !showShelf && hasShelf ? shelfHeight : 0,
        },
      ]}
    >
      {showShelf && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: shelfColor,
              borderRadius,
              top: shelfHeight,
              bottom: 0,
            },
          ]}
        />
      )}
      <Animated.View
        testID={faceTestID}
        style={[
          {
            borderRadius,
            opacity,
            transform: [{translateY}],
          },
          faceStyle,
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}
