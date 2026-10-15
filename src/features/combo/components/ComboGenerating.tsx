import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';

import {comboEdges} from './comboEdges';

type Props = {
  /** The word the set is made for, shown in the title and the second step. */
  word: string;
  /** "<situation> · <tense> · N câu", the choices being sent. */
  subline: string;
  /** How many sentences were asked for; up to four skeleton cards show. */
  count: number;
};

/**
 * When each step moves on, in ms. The Server sends no progress, so the steps
 * follow the usual timing; the last one keeps spinning until the set arrives.
 */
const PLAN: readonly {at: number; step: number; live: number}[] = [
  {at: 700, step: 1, live: 1},
  {at: 1700, step: 1, live: 2},
  {at: 2600, step: 2, live: 4},
];

const MAX_SKELETONS = 4;

/** Loops `value` from 0 to 1 and back, unless motion is reduced. */
function useLoop(duration: number, reduceMotion: boolean, delay = 0) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) {
      value.setValue(0.5);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, {
          duration: duration / 2,
          easing: Easing.inOut(Easing.ease),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          duration: duration / 2,
          easing: Easing.inOut(Easing.ease),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, duration, reduceMotion, value]);
  return value;
}

/**
 * Full-screen wait while a combo set is made: the word tile bobs among
 * sparkles, three steps tick off, and skeleton sentence cards light up one by
 * one. With reduced motion nothing moves; the steps still advance.
 */
export function ComboGenerating({word, subline, count}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [progress, setProgress] = useState({step: 0, live: 0});
  const skeletons = Math.max(1, Math.min(count, MAX_SKELETONS));

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const timers = PLAN.map(({at, step, live}) =>
      setTimeout(() => setProgress({step, live}), at),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const bob = useLoop(1600, reduceMotion);
  const spin = useRef(new Animated.Value(0)).current;
  const sparkA = useLoop(1600, reduceMotion);
  const sparkB = useLoop(1600, reduceMotion, 500);
  const sparkC = useLoop(1600, reduceMotion, 1000);
  const shimmer = useLoop(1200, reduceMotion);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.timing(spin, {
        duration: 800,
        easing: Easing.linear,
        toValue: 1,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, spin]);

  const steps = [
    t('combo.generating.step_pool'),
    t('combo.generating.step_write', {word}),
    t('combo.generating.step_check'),
  ];

  const sparkle = (
    value: Animated.Value,
    style: object,
    color: string,
    size: number,
  ) => (
    <Animated.View
      style={[
        styles.spark,
        style,
        {
          opacity: value.interpolate({
            inputRange: [0, 1],
            outputRange: [0.4, 1],
          }),
          transform: [
            {
              scale: value.interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 1.1],
              }),
            },
          ],
        },
      ]}
    >
      <MaterialIcon color={color} name="auto_awesome" size={size} />
    </Animated.View>
  );

  return (
    <View
      accessibilityViewIsModal
      style={themedStyles.overlay}
      testID="combo-generating"
    >
      <View style={styles.orb}>
        <Animated.View
          style={[
            themedStyles.tile,
            {
              transform: [
                {
                  translateY: bob.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -8],
                  }),
                },
                {
                  rotate: bob.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['-3deg', '3deg'],
                  }),
                },
              ],
            },
          ]}
        >
          <MaterialIcon
            color={theme.colors.onTertiaryContainer}
            name="style"
            size={30}
          />
        </Animated.View>
        {sparkle(sparkA, styles.sparkA, theme.colors.secondary, 18)}
        {sparkle(sparkB, styles.sparkB, theme.colors.primary, 18)}
        {sparkle(sparkC, styles.sparkC, theme.colors.onTertiaryContainer, 13)}
      </View>
      <View style={styles.titles}>
        <AppText
          accessibilityLiveRegion="polite"
          accessibilityRole="header"
          style={styles.center}
          testID="combo-generating-title"
          variant="h2"
        >
          {t('combo.generating.title', {word})}
        </AppText>
        <AppText color="muted" style={styles.center} variant="caption">
          {subline}
        </AppText>
      </View>
      <View style={themedStyles.steps}>
        {steps.map((label, index) => {
          const done = index < progress.step;
          const running = index === progress.step;
          return (
            <View
              accessibilityState={{busy: running, checked: done}}
              accessible
              key={label}
              style={[
                themedStyles.step,
                index === steps.length - 1 ? styles.lastStep : null,
              ]}
              testID={`combo-generating-step-${index}`}
            >
              <View
                style={[
                  themedStyles.dot,
                  running ? themedStyles.dotRunning : null,
                  done ? themedStyles.dotDone : null,
                ]}
              >
                {done ? (
                  <MaterialIcon
                    color={theme.colors.text.inverse}
                    name="check_circle"
                    size={14}
                  />
                ) : running ? (
                  <Animated.View
                    style={[
                      themedStyles.spinner,
                      {
                        transform: [
                          {
                            rotate: spin.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', '360deg'],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                ) : null}
              </View>
              <AppText
                color={done ? 'secondary' : running ? 'primary' : 'muted'}
                style={styles.grow}
                variant="label"
              >
                {label}
              </AppText>
            </View>
          );
        })}
      </View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.skeletons}
      >
        {Array.from({length: skeletons}, (_, index) => (
          <View
            key={index}
            style={[
              themedStyles.skeleton,
              index < progress.live ? null : styles.dim,
            ]}
          >
            <View style={themedStyles.skeletonNumber} />
            <Animated.View
              style={[
                styles.lines,
                {
                  opacity: shimmer.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.55, 1],
                  }),
                },
              ]}
            >
              <View style={themedStyles.line} />
              <View style={[themedStyles.line, styles.shortLine]} />
            </Animated.View>
          </View>
        ))}
      </View>
      <AppText color="muted" style={styles.center} variant="caption">
        {t('combo.generating.wait')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    textAlign: 'center',
  },
  dim: {
    opacity: 0.35,
  },
  grow: {
    flex: 1,
    minWidth: 0,
  },
  lastStep: {
    borderBottomWidth: 0,
  },
  lines: {
    flex: 1,
    gap: 6,
  },
  orb: {
    alignItems: 'center',
    height: 104,
    justifyContent: 'center',
    marginTop: 12,
    width: 104,
  },
  shortLine: {
    width: '62%',
  },
  skeletons: {
    alignSelf: 'stretch',
    gap: 10,
  },
  spark: {
    position: 'absolute',
  },
  sparkA: {
    right: 4,
    top: 0,
  },
  sparkB: {
    bottom: 6,
    left: 0,
  },
  sparkC: {
    left: -6,
    top: 30,
  },
  titles: {
    gap: 2,
  },
});

function makeStyles(theme: AppTheme) {
  const edge = theme.colors.surfaceHigh;
  return StyleSheet.create({
    overlay: {
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      bottom: 0,
      gap: 16,
      left: 0,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.xl,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    tile: {
      alignItems: 'center',
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: 24,
      height: 68,
      justifyContent: 'center',
      width: 68,
      ...getStickerEdge(3, comboEdges(theme).sun),
    },
    steps: {
      alignSelf: 'stretch',
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 6,
      ...getStickerEdge(3, edge),
    },
    step: {
      alignItems: 'center',
      borderBottomColor: theme.colors.outlineVariant,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: 10,
      paddingVertical: 9,
    },
    dot: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 9,
      height: 24,
      justifyContent: 'center',
      width: 24,
    },
    dotRunning: {
      backgroundColor: theme.colors.accentSoft,
    },
    dotDone: {
      backgroundColor: theme.colors.primary,
    },
    spinner: {
      borderColor: theme.colors.primary,
      borderRadius: 6,
      borderRightColor: theme.colors.accentSoft,
      borderWidth: 2.5,
      height: 12,
      width: 12,
    },
    skeleton: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 18,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      ...getStickerEdge(3, edge),
    },
    skeletonNumber: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 8,
      height: 24,
      width: 24,
    },
    line: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 5,
      height: 10,
    },
  });
}
