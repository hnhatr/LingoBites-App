/**
 * HomeDecorations — SVG paper-cut wave decorations and time-of-day badges.
 * (LING-256 I1, I2, I5, SVG-1)
 *
 * All motion is conditioned on useReducedMotion() (AD-002, D5):
 *   - wave fade-in (I1): static when reduced motion
 *   - heart particles (I2): hidden when reduced motion
 */
import React, {useEffect} from 'react';
import {StyleSheet, View} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {Defs, LinearGradient, Path, Rect, Stop, Svg} from 'react-native-svg';

import type {TimeOfDay} from '../logic/homeScreenModel';

// ---------------------------------------------------------------------------
// Paper-cut wave decoration
// ---------------------------------------------------------------------------
type WaveProps = {
  color: string;
  secondaryColor?: string;
  width?: number;
  height?: number;
  testID?: string;
};

export function HomeWaveDecoration({
  color,
  secondaryColor,
  width = 360,
  height = 80,
  testID,
}: WaveProps) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (!reducedMotion) {
      opacity.value = withTiming(1, {duration: 600});
    }
  }, [opacity, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, animatedStyle]}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="waveGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={color} stopOpacity="1" />
            <Stop
              offset="1"
              stopColor={secondaryColor ?? color}
              stopOpacity="0.6"
            />
          </LinearGradient>
        </Defs>
        <Path
          d={`M0,${height * 0.6} C${width * 0.25},${height * 0.2} ${
            width * 0.5
          },${height * 0.9} ${width},${
            height * 0.4
          } L${width},${height} L0,${height} Z`}
          fill="url(#waveGrad)"
        />
        <Path
          d={`M0,${height * 0.8} C${width * 0.3},${height * 0.5} ${
            width * 0.7
          },${height} ${width},${
            height * 0.7
          } L${width},${height} L0,${height} Z`}
          fill={color}
          fillOpacity={0.4}
        />
      </Svg>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Time-of-day sun/moon badge decoration
// ---------------------------------------------------------------------------
type TODBadgeProps = {
  timeOfDay: TimeOfDay;
  testID?: string;
};

const TOD_COLORS: Record<TimeOfDay, string> = {
  morning: '#FFD35E',
  afternoon: '#FF7043',
  night: '#7986CB',
};

export function TimeOfDayBadge({timeOfDay, testID}: TODBadgeProps) {
  const color = TOD_COLORS[timeOfDay];
  return (
    <View testID={testID ?? `home-tod-badge-${timeOfDay}`}>
      <Svg width={32} height={32} viewBox="0 0 24 24">
        {timeOfDay === 'night' ? (
          // Moon glyph
          <Path
            d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"
            fill={color}
          />
        ) : (
          // Sun glyph
          <Path
            d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .38-.39.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .38-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-12.37l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41-.38-.39-1.03-.39-1.41 0zM7.05 18.36l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41-.38-.39-1.03-.39-1.41 0z"
            fill={color}
          />
        )}
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Heart particle burst (I2) — tap-to-bounce + hearts; hidden under reduced motion
// ---------------------------------------------------------------------------
type HeartBurstProps = {
  visible: boolean;
  testID?: string;
};

export function HeartBurst({visible, testID}: HeartBurstProps) {
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
      {[0, 1, 2].map(i => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: 20 + i * 15,
            left: 30 + i * 20,
          }}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24">
            <Path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              fill="#FF6B6B"
            />
          </Svg>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Decorative blob shapes (paper-cut circles, replaces old HeroDecor)
// ---------------------------------------------------------------------------
type HeroBlobsProps = {
  coralColor?: string;
  mintColor?: string;
};

export function HeroBlobs({
  coralColor = '#EB6B6C',
  mintColor = '#6BD2AD',
}: HeroBlobsProps) {
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      testID="home-hero-blobs"
    >
      <View
        style={{
          position: 'absolute',
          right: -40,
          top: -48,
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: coralColor,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: -44,
          bottom: -60,
          width: 80,
          height: 90,
          borderRadius: 45,
          backgroundColor: mintColor,
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Confetti particle emitter for goal-met state (I7)
// ---------------------------------------------------------------------------
type ConfettiProps = {
  visible: boolean;
  testID?: string;
};

export function ConfettiParticles({visible, testID}: ConfettiProps) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion || !visible) return null;

  const COLORS = ['#FFD35E', '#FF7043', '#6BD2AD', '#7986CB', '#EB6B6C'];
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, {overflow: 'hidden'}]}
      testID={testID ?? 'home-confetti'}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {COLORS.map((color, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: 10 + (i % 3) * 20,
            left: 20 + i * 40,
            width: 8,
            height: 8,
            borderRadius: 2,
            backgroundColor: color,
            transform: [{rotate: `${i * 30}deg`}],
          }}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Star spark decorations (I1 — speech bubble entrance)
// ---------------------------------------------------------------------------
export function StarSpark({
  color = '#FFD35E',
  testID,
}: {
  color?: string;
  testID?: string;
}) {
  return (
    <View testID={testID ?? 'home-star-spark'}>
      <Svg width={16} height={16} viewBox="0 0 24 24">
        <Path
          d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
          fill={color}
        />
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Gradient rect background for decorative overlays
// ---------------------------------------------------------------------------
export function GradientRect({
  width,
  height,
  startColor,
  endColor,
  testID,
}: {
  width: number;
  height: number;
  startColor: string;
  endColor: string;
  testID?: string;
}) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      testID={testID}
    >
      <Defs>
        <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={startColor} stopOpacity="1" />
          <Stop offset="1" stopColor={endColor} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill="url(#grad)" />
    </Svg>
  );
}
