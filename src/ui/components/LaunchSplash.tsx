/**
 * LaunchSplash — animated brand intro shown over the app on cold start.
 *
 * Its first frame matches the native launch screen exactly (iOS
 * LaunchScreen.storyboard, Android drawable/launch_background.xml): the teal
 * gradient with the 150pt logo tile centred. From there the tile pops, a glow
 * ring pulses, sparkles and letter chips burst out, the "LingoBites" wordmark
 * rises letter by letter, then the whole overlay fades into the app.
 *
 * All motion is conditioned on useReducedMotion(): with reduced motion the
 * finished composition is shown statically and simply fades out.
 */
import React, {useEffect, useRef} from 'react';
import {Image, StyleSheet, View} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {Defs, LinearGradient, Path, Rect, Stop, Svg} from 'react-native-svg';

// Palette sampled from the app icon; keep in sync with the native launch
// screens (android/app/src/main/res/values/colors.xml, LaunchBackground).
const GRADIENT_TOP = '#3BBDA6';
const GRADIENT_CENTER = '#0F9387';
const GRADIENT_BOTTOM = '#0A5E5A';
const PEACH = '#FFC9A3';
const WHITE = '#ffffff';
const WORDMARK_SHADOW = 'rgba(4, 60, 56, 0.55)';
const TILE_SHADOW = '#03302d';
const RING_COLOR = 'rgba(255, 255, 255, 0.9)';
const CHIP_FILL = 'rgba(255, 255, 255, 0.2)';
const CHIP_BORDER = 'rgba(255, 255, 255, 0.55)';

const TILE_SIZE = 150;
// Letters repeat ("i"), so each carries a position-based id for its key.
const WORDMARK = 'LingoBites'
  .split('')
  .map((letter, index) => ({id: `${index}${letter}`, letter}));
const BITES_START = 5;

/** Time the intro holds before it starts fading out (ms). */
export const LAUNCH_SPLASH_HOLD_MS = 2100;
/** Duration of the fade into the app (ms). */
export const LAUNCH_SPLASH_EXIT_MS = 420;
const REDUCED_HOLD_MS = 600;

// Offsets from the tile centre; delays are relative to mount.
const SPARKLES = [
  {x: -112, y: -96, size: 26, color: WHITE, delay: 380},
  {x: 108, y: -118, size: 34, color: PEACH, delay: 460},
  {x: 124, y: 34, size: 18, color: WHITE, delay: 560},
  {x: -128, y: 52, size: 20, color: PEACH, delay: 640},
];

const CHIPS = [
  {label: 'ă', x: -96, y: -150, delay: 520, tilt: -10},
  {label: 'Aa', x: 92, y: -176, delay: 600, tilt: 8},
  {label: 'Hi!', x: -150, y: -20, delay: 680, tilt: -6},
];

type LaunchSplashProps = {
  /** Called once the overlay has fully faded out and can be unmounted. */
  onFinish: () => void;
  testID?: string;
};

export function LaunchSplash({onFinish, testID}: LaunchSplashProps) {
  const reducedMotion = useReducedMotion();
  // The intro runs exactly once; a new onFinish identity must not restart it.
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const overlayOpacity = useSharedValue(1);
  const tileScale = useSharedValue(1);
  const tileRotate = useSharedValue(0);
  const tileFloat = useSharedValue(0);
  const ring = useSharedValue(0);

  useEffect(() => {
    const hold = reducedMotion ? REDUCED_HOLD_MS : LAUNCH_SPLASH_HOLD_MS;
    const exit = reducedMotion ? 200 : LAUNCH_SPLASH_EXIT_MS;

    if (!reducedMotion) {
      // Anticipation squash, springy pop, then a gentle idle bob.
      tileScale.value = withSequence(
        withTiming(0.9, {duration: 140, easing: Easing.out(Easing.quad)}),
        withSpring(1.08, {damping: 6, stiffness: 180}),
        withSpring(1, {damping: 10, stiffness: 140}),
      );
      tileRotate.value = withSequence(
        withTiming(-6, {duration: 140}),
        withSpring(0, {damping: 5, stiffness: 160}),
      );
      tileFloat.value = withDelay(
        700,
        withRepeat(
          withTiming(1, {duration: 900, easing: Easing.inOut(Easing.quad)}),
          -1,
          true,
        ),
      );
      ring.value = withDelay(
        200,
        withRepeat(
          withTiming(1, {duration: 1100, easing: Easing.out(Easing.cubic)}),
          -1,
          false,
        ),
      );
    }

    const exitTimer = setTimeout(() => {
      overlayOpacity.value = withTiming(0, {
        duration: exit,
        easing: Easing.in(Easing.quad),
      });
      if (!reducedMotion) {
        tileScale.value = withTiming(1.18, {
          duration: exit,
          easing: Easing.in(Easing.quad),
        });
      }
    }, hold);
    const finishTimer = setTimeout(() => onFinishRef.current(), hold + exit);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(finishTimer);
    };
  }, [overlayOpacity, reducedMotion, ring, tileFloat, tileRotate, tileScale]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));
  const tileStyle = useAnimatedStyle(() => ({
    transform: [
      {translateY: tileFloat.value * -6},
      {scale: tileScale.value},
      {rotate: `${tileRotate.value}deg`},
    ],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - ring.value),
    transform: [{scale: 1 + ring.value * 1.1}],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, overlayStyle]}
      testID={testID ?? 'launch-splash'}
    >
      <Svg height="100%" style={StyleSheet.absoluteFill} width="100%">
        <Defs>
          <LinearGradient id="launchBg" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={GRADIENT_TOP} />
            <Stop offset="0.5" stopColor={GRADIENT_CENTER} />
            <Stop offset="1" stopColor={GRADIENT_BOTTOM} />
          </LinearGradient>
        </Defs>
        <Rect fill="url(#launchBg)" height="100%" width="100%" x="0" y="0" />
      </Svg>

      <View pointerEvents="none" style={styles.center}>
        <View style={styles.anchor}>
          {reducedMotion ? null : (
            <Animated.View style={[styles.ring, ringStyle]} />
          )}

          {CHIPS.map(chip => (
            <LetterChip
              key={chip.label}
              reducedMotion={reducedMotion}
              {...chip}
            />
          ))}
          {SPARKLES.map(sparkle => (
            <Sparkle
              key={`${sparkle.x}:${sparkle.y}`}
              reducedMotion={reducedMotion}
              {...sparkle}
            />
          ))}

          <Animated.View style={[styles.tile, tileStyle]}>
            <Image
              accessibilityIgnoresInvertColors
              source={require('@ui/assets/launch-logo.png')}
              style={styles.tileImage}
            />
          </Animated.View>

          <View style={styles.wordmark}>
            {WORDMARK.map(({id, letter}, index) => (
              <WordmarkLetter
                key={id}
                index={index}
                letter={letter}
                reducedMotion={reducedMotion}
              />
            ))}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

type WordmarkLetterProps = {
  index: number;
  letter: string;
  reducedMotion: boolean;
};

function WordmarkLetter({index, letter, reducedMotion}: WordmarkLetterProps) {
  const progress = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      620 + index * 55,
      withSpring(1, {damping: 9, stiffness: 160}),
    );
  }, [index, progress, reducedMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: Math.min(progress.value, 1),
    transform: [
      {translateY: (1 - progress.value) * 22},
      {scale: 0.6 + progress.value * 0.4},
    ],
  }));

  return (
    <Animated.Text
      style={[
        styles.letter,
        index >= BITES_START ? styles.letterBites : null,
        style,
      ]}
    >
      {letter}
    </Animated.Text>
  );
}

type SparkleProps = {
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
  reducedMotion: boolean;
};

function Sparkle({x, y, size, color, delay, reducedMotion}: SparkleProps) {
  const pop = useSharedValue(reducedMotion ? 1 : 0);
  const twinkle = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) {
      pop.value = 1;
      twinkle.value = 1;
      return;
    }
    pop.value = withDelay(delay, withSpring(1, {damping: 7, stiffness: 170}));
    twinkle.value = withDelay(
      delay + 500,
      withRepeat(
        withSequence(
          withTiming(0.55, {duration: 420}),
          withTiming(1, {duration: 420}),
        ),
        -1,
        false,
      ),
    );
  }, [delay, pop, reducedMotion, twinkle]);

  const style = useAnimatedStyle(() => ({
    opacity: Math.min(pop.value, 1) * (0.5 + twinkle.value * 0.5),
    transform: [
      {scale: pop.value * twinkle.value},
      {rotate: `${(1 - pop.value) * -90}deg`},
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.floating,
        {height: size, left: x - size / 2, top: y - size / 2, width: size},
        style,
      ]}
    >
      <Svg height={size} viewBox="0 0 24 24" width={size}>
        <Path
          d="M12 0C12.9 7.2 16.8 11.1 24 12C16.8 12.9 12.9 16.8 12 24C11.1 16.8 7.2 12.9 0 12C7.2 11.1 11.1 7.2 12 0Z"
          fill={color}
        />
      </Svg>
    </Animated.View>
  );
}

type LetterChipProps = {
  label: string;
  x: number;
  y: number;
  delay: number;
  tilt: number;
  reducedMotion: boolean;
};

function LetterChip({
  label,
  x,
  y,
  delay,
  tilt,
  reducedMotion,
}: LetterChipProps) {
  const burst = useSharedValue(reducedMotion ? 1 : 0);
  const bob = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      burst.value = 1;
      return;
    }
    // Chips fly out from behind the tile, then drift.
    burst.value = withDelay(
      delay,
      withSpring(1, {damping: 11, stiffness: 120}),
    );
    bob.value = withDelay(
      delay + 600,
      withRepeat(
        withTiming(1, {duration: 1100, easing: Easing.inOut(Easing.quad)}),
        -1,
        true,
      ),
    );
  }, [bob, burst, delay, reducedMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: Math.min(burst.value, 1),
    transform: [
      {translateX: x * burst.value},
      {translateY: y * burst.value + bob.value * -5},
      {scale: 0.3 + burst.value * 0.7},
      {rotate: `${tilt * burst.value}deg`},
    ],
  }));

  return (
    <Animated.View style={[styles.chip, style]}>
      <Animated.Text style={styles.chipText}>{label}</Animated.Text>
    </Animated.View>
  );
}

const CHIP_SIZE = 44;

const styles = StyleSheet.create({
  anchor: {
    height: 0,
    width: 0,
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    alignItems: 'center',
    backgroundColor: CHIP_FILL,
    borderColor: CHIP_BORDER,
    borderRadius: 14,
    borderWidth: 1.5,
    height: CHIP_SIZE,
    justifyContent: 'center',
    left: -CHIP_SIZE / 2,
    minWidth: CHIP_SIZE,
    paddingHorizontal: 8,
    position: 'absolute',
    top: -CHIP_SIZE / 2,
  },
  chipText: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '800',
  },
  floating: {
    position: 'absolute',
  },
  letter: {
    color: WHITE,
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: 0.5,
    textShadowColor: WORDMARK_SHADOW,
    textShadowOffset: {height: 3, width: 0},
    textShadowRadius: 0,
  },
  letterBites: {
    color: PEACH,
  },
  ring: {
    borderColor: RING_COLOR,
    borderRadius: TILE_SIZE,
    borderWidth: 2,
    height: TILE_SIZE * 1.3,
    left: (-TILE_SIZE * 1.3) / 2,
    position: 'absolute',
    top: (-TILE_SIZE * 1.3) / 2,
    width: TILE_SIZE * 1.3,
  },
  tile: {
    height: TILE_SIZE,
    left: -TILE_SIZE / 2,
    position: 'absolute',
    shadowColor: TILE_SHADOW,
    shadowOffset: {height: 10, width: 0},
    shadowOpacity: 0.35,
    shadowRadius: 18,
    top: -TILE_SIZE / 2,
    width: TILE_SIZE,
  },
  tileImage: {
    height: TILE_SIZE,
    width: TILE_SIZE,
  },
  wordmark: {
    flexDirection: 'row',
    justifyContent: 'center',
    left: -160,
    position: 'absolute',
    top: TILE_SIZE / 2 + 30,
    width: 320,
  },
});
