/**
 * HomeDecorations — SVG paper-cut decorations, time-of-day badges, wave shapes,
 * sparks, hearts, and full-screen confetti (LING-256, LING-267, §VS-0..§VS-7).
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
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {Circle, G, Line, Path, Svg} from 'react-native-svg';

import {CONFETTI_COLORS, type TimeOfDay} from '../logic/homeScreenModel';
import {HomeIcon} from './HomeSvgIcons';

// ---------------------------------------------------------------------------
// Hard shadow helper (§VS-0, R-001)
// ---------------------------------------------------------------------------
export function getHardShadow(offset: number, color = '#1c1c10') {
  return {
    shadowColor: color,
    shadowOffset: {width: 0, height: offset},
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: offset,
  };
}

// ---------------------------------------------------------------------------
// Time-of-day badge (§VS-1.1, I5)
// 46x46 circle, border 2 ink, HS(3)
// ---------------------------------------------------------------------------
type TODBadgeProps = {
  timeOfDay: TimeOfDay;
  testID?: string;
};

const TOD_BG: Record<TimeOfDay, string> = {
  morning: '#fff3c4',
  afternoon: '#ffe0c2',
  night: '#2b3a67',
};

export function TimeOfDayBadge({timeOfDay, testID}: TODBadgeProps) {
  const reducedMotion = useReducedMotion();
  const rotation = useSharedValue(0);
  const twinkle = useSharedValue(1);

  useEffect(() => {
    if (!reducedMotion) {
      if (timeOfDay === 'morning' || timeOfDay === 'afternoon') {
        // Sun rotates 360° per 18s linear loop (I5)
        rotation.value = withRepeat(
          withTiming(360, {duration: 18000, easing: Easing.linear}),
          -1,
          false,
        );
      } else {
        // Night stars twinkle 1.8s loop (I5)
        twinkle.value = withRepeat(
          withSequence(
            withTiming(0.4, {duration: 900}),
            withTiming(1, {duration: 900}),
          ),
          -1,
          true,
        );
      }
    } else {
      rotation.value = 0;
      twinkle.value = 1;
    }
  }, [reducedMotion, rotation, timeOfDay, twinkle]);

  const sunAnimStyle = useAnimatedStyle(() => ({
    transform: [{rotate: `${rotation.value}deg`}],
  }));

  const moonAnimStyle = useAnimatedStyle(() => ({
    opacity: twinkle.value,
  }));

  const isMorning = timeOfDay === 'morning';
  const isAfternoon = timeOfDay === 'afternoon';
  const isNight = timeOfDay === 'night';

  const sunFill = isMorning ? '#FFD35E' : '#ffa94d';
  const sunRayColor = isMorning ? '#f59e0b' : '#f76707';

  return (
    <View
      style={[styles.todBadgeContainer, {backgroundColor: TOD_BG[timeOfDay]}]}
      testID={testID ?? `home-tod-badge-${timeOfDay}`}
    >
      {isNight ? (
        <Svg width={38} height={38} viewBox="0 0 48 48">
          {/* Moon crescent */}
          <Path
            d="M30 9a15 15 0 1 0 9 26A13 13 0 0 1 30 9z"
            fill="#ffe08a"
            stroke="#1c1c10"
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
          {/* Craters */}
          <Circle cx={22} cy={30} r={2.2} fill="#f2c94c" />
          <Circle cx={17} cy={22} r={1.5} fill="#f2c94c" />
          {/* Twinkling stars */}
          <G opacity={0.9}>
            <Path
              d="M38 8l1.2 2.8L42 12l-2.8 1.2L38 16l-1.2-2.8L34 12l2.8-1.2z"
              fill="#ffffff"
            />
            <Path
              d="M8 13l.8 1.7 1.7.8-1.7.8L8 18l-.8-1.7-1.7-.8 1.7-.8z"
              fill="#ffffff"
            />
          </G>
        </Svg>
      ) : (
        <Animated.View style={sunAnimStyle}>
          <Svg width={38} height={38} viewBox="0 0 48 48">
            {/* 8 rays at k * 45° from r 14 to r 19 */}
            {[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
              const a = (i * Math.PI) / 4;
              const x1 = 24 + Math.cos(a) * 14;
              const y1 = 24 + Math.sin(a) * 14;
              const x2 = 24 + Math.cos(a) * 19;
              const y2 = 24 + Math.sin(a) * 19;
              return (
                <Line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={sunRayColor}
                  strokeWidth={3.2}
                  strokeLinecap="round"
                />
              );
            })}
            {/* Core circle */}
            <Circle
              cx={24}
              cy={24}
              r={10}
              fill={sunFill}
              stroke="#1c1c10"
              strokeWidth={2.2}
            />
            {/* Highlight circle */}
            <Circle cx={20.5} cy={21} r={2.6} fill="#ffffff" opacity={0.7} />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Paper-cut Waves decoration (§VS-2.2)
// viewBox 0 0 360 70, no aspect ratio kept, back #3d88c4, front #6BD2AD, stroke #1c1c10 2
// ---------------------------------------------------------------------------
export function HomeHeroWaves({testID}: {testID?: string}) {
  return (
    <View
      style={styles.wavesContainer}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      testID={testID ?? 'home-hero-waves'}
    >
      <Svg
        width="100%"
        height={70}
        viewBox="0 0 360 70"
        preserveAspectRatio="none"
      >
        <Path
          d="M0 34 C60 10 110 52 180 30 S300 8 360 28 V70 H0Z"
          fill="#3d88c4"
          stroke="#1c1c10"
          strokeWidth={2}
        />
        <Path
          d="M0 52 C70 34 120 66 200 48 S310 36 360 50 V70 H0Z"
          fill="#6BD2AD"
          stroke="#1c1c10"
          strokeWidth={2}
        />
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sparks (§VS-2.2, white at opacity 0.85)
// ---------------------------------------------------------------------------
export function HomeHeroSparks() {
  const reducedMotion = useReducedMotion();
  const sparkTwinkle = useSharedValue(1);

  useEffect(() => {
    if (!reducedMotion) {
      sparkTwinkle.value = withRepeat(
        withSequence(
          withTiming(0.4, {duration: 1100}),
          withTiming(1, {duration: 1100}),
        ),
        -1,
        true,
      );
    } else {
      sparkTwinkle.value = 1;
    }
  }, [reducedMotion, sparkTwinkle]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: sparkTwinkle.value * 0.85,
  }));

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      testID="home-hero-sparks"
    >
      {/* Spark 1: auto_awesome 16 at left 46%, top 16 */}
      <Animated.View style={[styles.spark1, animStyle]}>
        <HomeIcon name="auto_awesome" size={16} color="#ffffff" />
      </Animated.View>
      {/* Spark 2: star 12 at left 8, top 10 */}
      <Animated.View style={[styles.spark2, animStyle]}>
        <HomeIcon name="star" size={12} color="#ffffff" />
      </Animated.View>
      {/* Spark 3: star 10 at right 110, bottom 58 */}
      <Animated.View style={[styles.spark3, animStyle]}>
        <HomeIcon name="star" size={10} color="#ffffff" />
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Heart burst (I2) — 4 hearts on cat tap (§VS-2.3, §VS-7)
// 14/17/20/23 pt #ff5d7a, rise 70, scale 1.3, fade out, 1.1s, stagger 120ms
// ---------------------------------------------------------------------------
const HEART_CONFIGS = [
  {size: 14, startBottom: 70, startRight: 40, delay: 0},
  {size: 17, startBottom: 90, startRight: 75, delay: 120},
  {size: 20, startBottom: 110, startRight: 50, delay: 240},
  {size: 23, startBottom: 85, startRight: 95, delay: 360},
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
export const HomeWaveDecoration = HomeHeroWaves;

const styles = StyleSheet.create({
  todBadgeContainer: {
    alignItems: 'center',
    borderRadius: 23,
    borderWidth: 2,
    borderColor: '#1c1c10',
    height: 46,
    justifyContent: 'center',
    width: 46,
    ...getHardShadow(3),
  },
  wavesContainer: {
    bottom: -2,
    height: 70,
    left: -2,
    position: 'absolute',
    right: -2,
  },
  spark1: {
    left: '46%',
    position: 'absolute',
    top: 16,
  },
  spark2: {
    left: 8,
    position: 'absolute',
    top: 10,
  },
  spark3: {
    bottom: 58,
    position: 'absolute',
    right: 110,
  },
  confettiOverlay: {
    zIndex: 99,
  },
});
