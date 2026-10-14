/**
 * HomeDecorations — hearts for the cat tap and full-screen confetti
 * (LING-256, LING-267, §VS-0..§VS-7).
 *
 * All motion is conditioned on useReducedMotion() (AD-002, D5, §VS-7).
 */
import React, {useEffect} from 'react';
import {Dimensions, StyleSheet, View} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import {getHardShadow, getStickerEdge} from '@ui/theme/hardShadow';

import {CONFETTI_COLORS} from '../logic/homeScreenModel';
import {HomeIcon} from './HomeSvgIcons';

// ---------------------------------------------------------------------------
// Hard shadow helper (§VS-0, R-001)
// ---------------------------------------------------------------------------
export {getHardShadow, getStickerEdge};

// ---------------------------------------------------------------------------
// Heart burst (I2) — 4 hearts on the header cat tap (§VS-7)
// 12/14/16/18 pt #ff5d7a, rise 70, scale 1.3, fade out, 1.1s, stagger 120ms
// ---------------------------------------------------------------------------
const HEART_CONFIGS = [
  {size: 12, startBottom: 30, startRight: 4, delay: 0},
  {size: 14, startBottom: 40, startRight: 30, delay: 120},
  {size: 16, startBottom: 48, startRight: 14, delay: 240},
  {size: 18, startBottom: 36, startRight: -10, delay: 360},
];

function AnimatedHeart({
  size,
  startBottom,
  startRight,
  delay,
}: {
  size: number;
  startBottom: number;
  startRight: number;
  delay: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, {duration: 1100, easing: Easing.out(Easing.quad)}),
    );
  }, [delay, progress]);

  const style = useAnimatedStyle(() => {
    const translateY = -70 * progress.value;
    const scale = 1 + 0.3 * progress.value;
    const opacity = 1 - progress.value;
    return {
      position: 'absolute',
      bottom: startBottom,
      right: startRight,
      opacity,
      transform: [{translateY}, {scale}],
    };
  });

  return (
    <Animated.View style={style}>
      <HomeIcon name="favorite" size={size} color="#ff5d7a" />
    </Animated.View>
  );
}

export function HeartBurst({
  visible,
  testID,
}: {
  visible: boolean;
  testID?: string;
}) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion || !visible) return null;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      testID={testID ?? 'home-heart-burst'}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {HEART_CONFIGS.map((cfg, i) => (
        <AnimatedHeart
          key={i}
          size={cfg.size}
          startBottom={cfg.startBottom}
          startRight={cfg.startRight}
          delay={cfg.delay}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Confetti overlay (I7, §VS-7)
// Single screen-level overlay: 46 pieces 8x12, radius 2, border 1.5 ink
// ---------------------------------------------------------------------------
const CONFETTI_PIECES = Array.from({length: 46}, (_, i) => {
  const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
  const screenWidth = Dimensions.get('window').width || 390;
  const startX = (i * (screenWidth / 46) + ((i * 17) % 25)) % screenWidth;
  const duration = 1600 + ((i * 137) % 1200); // 1.6s - 2.8s
  const delay = (i * 83) % 700; // 0 - 0.7s
  const rotationEnd = 360 + ((i * 45) % 360);
  return {id: i, color, startX, duration, delay, rotationEnd};
});

function ConfettiPiece({
  color,
  startX,
  duration,
  delay,
  rotationEnd,
}: {
  color: string;
  startX: number;
  duration: number;
  delay: number;
  rotationEnd: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, {duration, easing: Easing.inOut(Easing.quad)}),
    );
  }, [delay, duration, progress]);

  const style = useAnimatedStyle(() => {
    const translateY = progress.value * 860;
    const rotate = `${progress.value * rotationEnd}deg`;
    const opacity = progress.value > 0.85 ? (1 - progress.value) / 0.15 : 1;
    return {
      position: 'absolute',
      top: -20,
      left: startX,
      width: 8,
      height: 12,
      borderRadius: 2,
      borderWidth: 1.5,
      borderColor: '#1c1c10',
      backgroundColor: color,
      opacity,
      transform: [{translateY}, {rotate}],
    };
  });

  return <Animated.View style={style} />;
}

export function ConfettiOverlay({
  visible,
  testID,
}: {
  visible: boolean;
  testID?: string;
}) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion || !visible) return null;

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.confettiOverlay]}
      testID={testID ?? 'home-confetti'}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {CONFETTI_PIECES.map(p => (
        <ConfettiPiece
          key={p.id}
          color={p.color}
          startX={p.startX}
          duration={p.duration}
          delay={p.delay}
          rotationEnd={p.rotationEnd}
        />
      ))}
    </View>
  );
}

// Backward-compatible exports for legacy tests
export const ConfettiParticles = ConfettiOverlay;

const styles = StyleSheet.create({
  confettiOverlay: {
    zIndex: 99,
  },
});
