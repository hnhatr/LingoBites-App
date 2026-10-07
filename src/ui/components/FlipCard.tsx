import React, {useEffect, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import {useAppTheme} from '../theme';
import {AppCard} from './AppCard';
import {AppText} from './AppText';
import {MaterialIcon} from './MaterialIcon';

export interface FlipCardProps {
  flipped: boolean;
  onFlip: () => void;
  front: React.ReactNode;
  back: React.ReactNode;
  frontHint?: string;
  backHint?: string;
  style?: ViewStyle;
  /** Minimum height of the card face content (default 320). */
  minHeight?: number;
  testID?: string;
}

export function FlipCard({
  flipped,
  onFlip,
  front,
  back,
  frontHint = 'Nhấn để xem mặt sau',
  backHint = 'Nhấn để xem mặt trước',
  style,
  minHeight = 320,
  testID = 'flip-card',
}: FlipCardProps) {
  const {theme} = useAppTheme();
  const [reduceMotion, setReduceMotion] = useState(false);
  // 1 = edge-on (90deg), 0 = facing the learner.
  const turn = useRef(new Animated.Value(0)).current;
  const firstRender = useRef(true);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => sub.remove();
  }, []);

  // The new face renders immediately (content never waits on an animation);
  // the card then turns in from edge-on so the swap reads as a flip.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (reduceMotion) {
      turn.setValue(0);
      return;
    }
    turn.setValue(1);
    Animated.timing(turn, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
  }, [flipped, reduceMotion, turn]);

  const rotateY = turn.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', flipped ? '-90deg' : '90deg'],
  });

  return (
    <Pressable
      accessibilityHint="Chạm để lật thẻ"
      accessibilityRole="button"
      accessibilityState={{expanded: flipped}}
      accessibilityValue={{text: flipped ? 'Mặt sau' : 'Mặt trước'}}
      onPress={onFlip}
      testID={testID}
    >
      <Animated.View style={{transform: [{perspective: 1000}, {rotateY}]}}>
        <AppCard style={style}>
          <View
            style={StyleSheet.flatten([styles.contentContainer, {minHeight}])}
          >
            {flipped ? back : front}
          </View>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.hintRow}
            testID="flip-card-hint"
          >
            <MaterialIcon
              color={theme.colors.text.muted}
              name="refresh"
              size={16}
            />
            <AppText color="muted" style={styles.hintText} variant="caption">
              {flipped ? backHint : frontHint}
            </AppText>
          </View>
        </AppCard>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    width: '100%',
  },
  hintRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 12,
  },
  hintText: {
    textAlign: 'center',
  },
});
